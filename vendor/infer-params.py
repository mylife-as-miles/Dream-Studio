"""
Types implicit-`any` parameters from how the function body uses them.

Driven by the compiler's own error positions, so it never has to parse
TypeScript. For each reported parameter it reads the enclosing body and asks a
single question: what does the code *do* with this value?

  used with .x / .copy / .normalize ...  -> Vector3
  used with any other member access      -> left alone (a shape a human decides)
  used only as a condition               -> boolean
  otherwise                              -> number

Name-based guessing was tried first and rejected: `contour` and `local` sound
like points and are indices, and flipping them created more mismatches than it
fixed. Usage is the thing that is actually true.

Usage:  npx tsc --noEmit -p tsconfig.json 2>&1 | grep TS7006 > implicit.txt
        python vendor/infer-params.py implicit.txt
"""

import io
import re
import sys
from collections import defaultdict

VEC_MEMBERS = {
    "x", "y", "z", "w", "copy", "set", "clone", "add", "sub", "normalize", "length",
    "lengthSq", "multiplyScalar", "addScaledVector", "crossVectors", "subVectors",
    "distanceTo", "setY", "setX", "setZ", "applyQuaternion", "applyMatrix4", "negate",
    "setFromMatrixPosition", "lerp", "dot", "cross",
}


def enclosing_body(lines, ln):
    depth, out = 0, []
    for i in range(ln - 1, min(len(lines), ln + 400)):
        out.append(lines[i])
        depth += lines[i].count("{") - lines[i].count("}")
        if i > ln - 1 and depth <= 0:
            break
    return "\n".join(out)


def main() -> None:
    edits = defaultdict(list)
    for line in io.open(sys.argv[1], encoding="utf-8"):
        m = re.match(r"^(.+?)\((\d+),(\d+)\): error TS7006: Parameter '(\w+)'", line.strip())
        if m:
            edits[m.group(1)].append((int(m.group(2)), int(m.group(3)), m.group(4)))

    changed = 0
    for path, items in edits.items():
        lines = io.open(path, encoding="utf-8").read().split("\n")
        for ln, col, name in sorted(items, key=lambda x: (-x[0], -x[1])):
            body = enclosing_body(lines, ln)
            members = set(re.findall(rf"\b{re.escape(name)}\.([A-Za-z_]\w*)", body))
            if members & VEC_MEMBERS:
                t = "Vector3"
            elif members:
                continue
            elif re.search(rf"\b{re.escape(name)}\s*\?", body) or re.search(rf"!\s*{re.escape(name)}\b", body):
                t = "boolean"
            else:
                t = "number"

            s = lines[ln - 1]
            at = col - 1
            if s[at:at + len(name)] != name:
                continue
            end = at + len(name)
            if end < len(s) and s[end] == ":":
                continue
            lines[ln - 1] = s[:end] + f": {t}" + s[end:]
            changed += 1
        io.open(path, "w", encoding="utf-8", newline="").write("\n".join(lines))

    print(f"typed {changed} parameters from usage")


if __name__ == "__main__":
    main()
