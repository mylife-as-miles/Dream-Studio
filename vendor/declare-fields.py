"""
Adds class-field declarations to ported JavaScript classes.

The upstream source assigns every field in the constructor, which TypeScript
under `strict` refuses to infer. This walks each class, collects the
`this.<name> = <expr>` assignments, guesses a type from the initialiser, and
emits declarations directly under the class opening brace.

It is a best-effort pass, not a type checker: anything it cannot read confidently
is emitted commented-out so the remaining errors point straight at the fields a
human still has to decide on, rather than being silently widened.
"""

import re
import sys
from pathlib import Path

# expr -> type, tried in order. First match wins.
RULES = [
    (r"^new\s+([A-Z][A-Za-z0-9_]*)\s*(?:<[^>]*>)?\s*\(", lambda m: m.group(1)),
    (r"^-?\d+(\.\d+)?(e-?\d+)?$", lambda m: "number"),
    (r"^(true|false)$", lambda m: "boolean"),
    (r"^['\"`]", lambda m: "string"),
    (r"^\[\s*\]$", lambda m: None),           # empty array: element type unknown
    (r"^\{\s*\}$", lambda m: None),           # empty object
    (r"^null$", lambda m: None),
    (r"^undefined$", lambda m: None),
    (r"^Object\.freeze\(", lambda m: None),
    (r"^Math\.", lambda m: "number"),
]

CLASS_RE = re.compile(r"^(\s*)(?:export\s+)?class\s+(\w+)", re.M)
ASSIGN_RE = re.compile(r"^\s*this\.([A-Za-z_$][\w$]*)\s*=\s*(.+?);?\s*$", re.M)


def guess(expr: str):
    expr = expr.strip()
    for pattern, produce in RULES:
        m = re.match(pattern, expr)
        if m:
            return produce(m)
    return None


def class_body_span(src: str, start: int):
    """Returns (open_brace_index, close_brace_index) for the class at `start`."""
    i = src.find("{", start)
    if i < 0:
        return None
    depth = 0
    for j in range(i, len(src)):
        c = src[j]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return i, j
    return None


def process(path: Path) -> bool:
    src = path.read_text(encoding="utf-8")
    out = src
    offset = 0

    for m in CLASS_RE.finditer(src):
        indent, name = m.group(1), m.group(2)
        span = class_body_span(src, m.end())
        if not span:
            continue
        open_i, close_i = span
        body = src[open_i:close_i]

        # Skip fields that are already declared.
        declared = set(
            re.findall(r"^\s*(?:readonly\s+|private\s+|public\s+)*([A-Za-z_$][\w$]*)\s*[:=]", body, re.M)
        )

        seen, decls = set(), []
        for a in ASSIGN_RE.finditer(body):
            field, expr = a.group(1), a.group(2)
            if field in seen or field in declared:
                continue
            seen.add(field)
            t = guess(expr)
            if t:
                decls.append(f"{indent}  {field}!: {t};")
            else:
                decls.append(f"{indent}  // TODO(port): declare `{field}` -- initialiser: {expr[:60]}")

        if not decls:
            continue

        insert_at = open_i + 1 + offset
        block = "\n" + "\n".join(decls) + "\n"
        out = out[:insert_at] + block + out[insert_at:]
        offset += len(block)

    if out != src:
        path.write_text(out, encoding="utf-8", newline="")
        return True
    return False


if __name__ == "__main__":
    changed = 0
    for arg in sys.argv[1:]:
        p = Path(arg)
        if p.is_file() and process(p):
            changed += 1
            print(f"  declared fields in {p.name}")
    print(f"{changed} file(s) updated")
