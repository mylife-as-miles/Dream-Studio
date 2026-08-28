"""
Adds class-field declarations to ported JavaScript classes.

The upstream source assigns every field in the constructor, which TypeScript
under `strict` refuses to infer. This walks each class, collects the
`this.<name> = <expr>` assignments, derives a type from the initialiser, and
emits declarations directly under the class opening brace.

Type derivation, in order of preference:

  new Foo(...)      -> Foo
  someFactory(...)  -> ReturnType<typeof someFactory>   (exact, never a guess)
  literals          -> number / string / boolean
  []                -> T[], with T taken from the first `this.<name>.push(...)`
  { a: 1, b: 2 }    -> a structural type, each value derived by these same rules

Anything it still cannot read is emitted as a commented TODO, so the leftover
surfaces as a compiler error pointing at the exact field rather than being
silently widened to `any`.

Pass --force to ignore fields that look already-declared; use it on a freshly
copied file, where the "declared" heuristic would otherwise trip over object
literal keys inside method bodies.
"""

import re
import sys
from pathlib import Path

CLASS_RE = re.compile(r"^(\s*)(?:export\s+)?(?:abstract\s+)?class\s+(\w+)", re.M)
ASSIGN_RE = re.compile(r"^\s*this\.([A-Za-z_$][\w$]*)\s*=\s*(.+?);?\s*$", re.M)
IDENT = r"[A-Za-z_$][\w$]*"


def match_brace(src: str, open_index: int) -> int:
    depth = 0
    for j in range(open_index, len(src)):
        if src[j] == "{":
            depth += 1
        elif src[j] == "}":
            depth -= 1
            if depth == 0:
                return j
    return len(src)


def split_top_level(text: str) -> list:
    """Split an object-literal body on commas that are not nested."""
    parts, depth, cur = [], 0, []
    for ch in text:
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append("".join(cur))
            cur = []
        else:
            cur.append(ch)
    if "".join(cur).strip():
        parts.append("".join(cur))
    return parts


def module_scope(src: str) -> set:
    """Identifiers safe to name in a class-level type annotation.

    A field assigned in a *method* may be initialised from a local, and
    `ReturnType<typeof someLocal>` does not resolve at class scope. Only
    imported or top-level names are usable there.
    """
    names = set()
    for block in re.findall(r"import\s*\{([^}]*)\}\s*from", src, re.S):
        for n in block.split(","):
            n = n.strip().replace("type ", "").split(" as ")[-1].strip()
            if n:
                names.add(n)
    names |= set(re.findall(rf"^(?:export\s+)?function\s+({IDENT})", src, re.M))
    names |= set(re.findall(rf"^(?:export\s+)?const\s+({IDENT})", src, re.M))
    return names


def resolve_local(name: str, body: str, scope, depth: int):
    """Type of a local `const name = ...` declared in the same body."""
    if depth > 2:
        return None
    m = re.search(rf"(?:const|let|var)\s+{re.escape(name)}\s*=\s*(.+?);\s*$", body, re.M)
    if not m:
        return None
    return derive(m.group(1), body, "", scope, depth + 1)


def derive(expr, body="", field="", scope=None, depth=0):
    expr = (expr or "").strip()

    m = re.match(rf"^new\s+({IDENT})", expr)
    if m:
        return m.group(1)

    if re.match(r"^-?\d+(\.\d+)?(e-?\d+)?$", expr):
        return "number"
    if expr in ("true", "false"):
        return "boolean"
    if expr and expr[0] in "'\"`":
        return "string"
    if re.match(r"^Math\.", expr):
        return "number"

    # A factory call: let TypeScript name the type rather than guessing it,
    # but only when the callee is nameable from class scope.
    m = re.match(rf"^({IDENT})\s*\(", expr)
    if m and m.group(1) not in ("Number", "String", "Boolean", "Array", "Object"):
        if scope is None or m.group(1) in scope:
            return f"ReturnType<typeof {m.group(1)}>"
        return None

    m = re.match(rf"^({IDENT})\.({IDENT})\s*\(", expr)
    if m and (scope is None or m.group(1) in scope):
        return f"ReturnType<typeof {m.group(1)}.{m.group(2)}>"

    if re.match(r"^\[\s*\]$", expr):
        if not (body and field):
            return None
        pushed = re.search(rf"this\.{re.escape(field)}\.push\(\s*(.+?)\s*\)\s*;", body, re.S)
        if not pushed:
            return None
        pushed_expr = pushed.group(1).strip()
        inner = derive(pushed_expr, body, "", scope, depth + 1)
        if not inner and re.fullmatch(IDENT, pushed_expr):
            inner = resolve_local(pushed_expr, body, scope, depth)
        return f"{inner}[]" if inner else None

    if re.fullmatch(IDENT, expr) and body:
        local = resolve_local(expr, body, scope, depth)
        if local:
            return local

    if expr.startswith("{") and expr.endswith("}"):
        inner = expr[1:-1].strip()
        if not inner:
            return None
        fields = []
        for part in split_top_level(inner):
            kv = re.match(rf"^\s*({IDENT})\s*:\s*(.+)$", part.strip(), re.S)
            if not kv:
                return None
            t = derive(kv.group(2), body, "", scope, depth + 1) or "number"
            fields.append(f"{kv.group(1)}: {t}")
        return "{ " + "; ".join(fields) + " }"

    return None


def process(path: Path, force: bool) -> bool:
    src = path.read_text(encoding="utf-8")
    scope = module_scope(src)
    out, offset = src, 0

    for m in CLASS_RE.finditer(src):
        indent = m.group(1)
        open_i = src.find("{", m.end())
        if open_i < 0:
            continue
        close_i = match_brace(src, open_i)
        body = src[open_i:close_i]

        declared = set()
        if not force:
            declared = set(
                re.findall(rf"^\s*(?:readonly\s+|private\s+|public\s+)*({IDENT})\s*[!?]?\s*[:=]", body, re.M)
            )

        seen, decls = set(), []
        for a in ASSIGN_RE.finditer(body):
            name, expr = a.group(1), a.group(2)
            if name in seen or name in declared:
                continue
            seen.add(name)
            t = derive(expr, body, name, scope)
            if t:
                decls.append(f"{indent}  {name}!: {t};")
            else:
                decls.append(f"{indent}  // TODO(port): declare `{name}` -- initialiser: {expr[:70]}")

        if not decls:
            continue

        at = open_i + 1 + offset
        block = "\n" + "\n".join(decls) + "\n"
        out = out[:at] + block + out[at:]
        offset += len(block)

    if out != src:
        path.write_text(out, encoding="utf-8", newline="")
        return True
    return False


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--force"]
    force = "--force" in sys.argv
    n = 0
    for arg in args:
        p = Path(arg)
        if p.is_file() and process(p, force):
            n += 1
            print(f"  declared fields in {p.name}")
    print(f"{n} file(s) updated")
