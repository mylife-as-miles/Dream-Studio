"""
Types the `sync(state)` callbacks in the ported material factories.

Each material exposes `material.userData.sync = (state) => {...}`, reading a
different subset of the values its ability hands it. Rather than invent one
union that fits all of them loosely, this derives an exact inline type per
callback from the fields that callback actually touches.

A field is a Vector3 when it is passed to `.copy()`, and a number otherwise --
which covers every case in this source.
"""

import re
import sys
from pathlib import Path

SYNC_RE = re.compile(r"(userData\.sync\s*=\s*)\((state)\)(\s*=>\s*\{)")


def body_span(src: str, brace_index: int):
    depth = 0
    for j in range(brace_index, len(src)):
        c = src[j]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return j
    return len(src)


def process(path: Path) -> bool:
    src = path.read_text(encoding="utf-8")
    out = []
    last = 0
    changed = False

    for m in SYNC_RE.finditer(src):
        brace = src.index("{", m.end() - 1)
        end = body_span(src, brace)
        body = src[brace:end]

        fields = sorted(set(re.findall(r"state\.([A-Za-z0-9_]+)", body)))
        if not fields:
            continue

        vectors = set(re.findall(r"\.copy\(state\.([A-Za-z0-9_]+)\)", body))
        parts = [f"{f}: {'Vector3' if f in vectors else 'number'}" for f in fields]
        annotation = "{ " + "; ".join(parts) + " }"

        out.append(src[last:m.start()])
        out.append(f"{m.group(1)}(state: {annotation}){m.group(3)}")
        last = m.end()
        changed = True

    if not changed:
        return False

    out.append(src[last:])
    result = "".join(out)

    # Vector3 must be imported wherever the annotation mentions it.
    if "Vector3" in result:
        im = re.search(r"^import \{([^}]*)\} from 'three';", result, re.M)
        if im:
            names = [n.strip() for n in im.group(1).split(",") if n.strip()]
            if "Vector3" not in names and "type Vector3" not in names:
                names.append("Vector3")
                joined = ",\n  ".join(sorted(set(names)))
                result = result[: im.start()] + "import {\n  " + joined + "\n} from 'three';" + result[im.end():]

    path.write_text(result, encoding="utf-8", newline="")
    return True


if __name__ == "__main__":
    n = 0
    for arg in sys.argv[1:]:
        p = Path(arg)
        if p.is_file() and process(p):
            n += 1
            print(f"  typed sync state in {p.name}")
    print(f"{n} file(s) updated")
