"""
Corrects parameter types that the usage pass got backwards.

The compiler reports these at the *call* site ("argument of type Vector3 is not
assignable to parameter of type number"), but the thing to change is the
*declaration*. This walks from one to the other: read the call on the reported
line, work out which argument position is at the reported column, find the
method's declaration, and flip that parameter to the type actually being passed.

Only flips between the two types this port confuses -- number and Vector3 -- and
only when the declaration is an unambiguous single-line method signature.

Usage:  npx tsc --noEmit -p tsconfig.json 2>&1 | grep TS2345 > mismatch.txt
        python vendor/flip-params.py mismatch.txt
"""

import io
import re
import sys
from collections import defaultdict

PAIR = {"Vector3": "number", "number": "Vector3"}


def arg_index(line: str, col: int):
    """Which argument position the reported column falls in, and the callee."""
    open_paren = line.rfind("(", 0, col)
    if open_paren < 0:
        return None, None
    head = re.search(r"([A-Za-z_$][\w$]*)\s*$", line[:open_paren])
    if not head:
        return None, None
    depth, index = 0, 0
    for ch in line[open_paren + 1: col - 1]:
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        elif ch == "," and depth == 0:
            index += 1
    return head.group(1), index


def main() -> None:
    fixes = defaultdict(set)
    for raw in io.open(sys.argv[1], encoding="utf-8"):
        m = re.match(
            r"^(.+?)\((\d+),(\d+)\): error TS2345: Argument of type '(\w+)' is not assignable to parameter of type '(\w+)'",
            raw.strip(),
        )
        if not m:
            continue
        path, ln, col, actual, declared = m.group(1), int(m.group(2)), int(m.group(3)), m.group(4), m.group(5)
        if declared not in PAIR or PAIR[declared] != actual:
            continue
        line = io.open(path, encoding="utf-8").read().split("\n")[ln - 1]
        callee, index = arg_index(line, col)
        if callee is None:
            continue
        fixes[path].add((callee, index, actual))

    changed = 0
    for path, items in fixes.items():
        src = io.open(path, encoding="utf-8").read()
        for callee, index, actual in items:
            decl = re.search(rf"^(  (?:private |readonly |override )?{re.escape(callee)})\(([^)(]*)\)(\s*\{{)$", src, re.M)
            if not decl:
                continue
            params = [p.strip() for p in decl.group(2).split(",")]
            if index >= len(params):
                continue
            name = params[index].split(":")[0].strip()
            params[index] = f"{name}: {actual}"
            src = src.replace(decl.group(0), f"{decl.group(1)}({', '.join(params)}){decl.group(3)}")
            changed += 1
        io.open(path, "w", encoding="utf-8", newline="").write(src)

    print(f"flipped {changed} parameters")


if __name__ == "__main__":
    main()
