"""
The proven-safe part of the JS -> TS port, as one repeatable pass.

Everything here is either exact (a type TypeScript can name itself) or derived
from what the code demonstrably does. It deliberately does *not* guess a
parameter's type from its name -- that pass was tried, and flipping `contour`
or `local` to Vector3 because the name sounded like a point created more
mismatches than it fixed. Whatever this leaves untyped is meant to be read and
typed by hand.

Usage:  python vendor/port-file.py <src.js> <dst.ts> [--element pyre]
"""

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def fix_specifiers(s: str) -> str:
    s = re.sub(r"(from '[^']*)\.js'", r"\1'", s)
    s = s.replace("../assets/ProceduralGeometry", "../geometry/ProceduralGeometry")
    s = s.replace("../rendering/materialSettings", "../materialSettings")
    return s


def type_emit_scratch(s: str) -> str:
    """The shared per-module emission bag handed to the particle engine."""
    if not re.search(r"^const _emit = \{\};$", s, re.M):
        return s
    s = re.sub(
        r"^const _emit = \{\};$",
        "// One scratch emission bag per module, refilled and handed to the particle\n"
        "// engine each time. `emit` reads it and never retains it, which is what keeps\n"
        "// a frame of emission allocation-free.\n"
        "const _emit: ParticleEmitParams = { position: new Vector3() };",
        s,
        flags=re.M,
    )
    if "ParticleEmitParams" not in s.split("const _emit")[0]:
        imports = list(re.finditer(r"^import .*?;$", s, re.M | re.S))
        at = imports[-1].end()
        s = s[:at] + '\nimport type { ParticleEmitParams } from "../particles/ParticleSystem";' + s[at:]
    return s


def type_context(s: str, is_boost: bool) -> str:
    ctx = "BoostContext" if is_boost else "AbilityContext"
    if not re.search(r"constructor\(context\)", s):
        return s
    s = re.sub(r"constructor\(context\)", f"constructor(context: {ctx})", s)
    if f"{ctx} }}" not in s:
        rel = "./BoostContext" if is_boost else "./AbilityContext"
        imports = list(re.finditer(r"^import .*?;$", s, re.M | re.S))
        at = imports[-1].end()
        s = s[:at] + f'\nimport type {{ {ctx} }} from "{rel}";' + s[at:]
    return s


def ensure_three(s: str, names) -> str:
    m = re.search(r"import \{([^}]*)\} from 'three';", s, re.S)
    if not m:
        return s
    have = [n.strip() for n in m.group(1).split(",") if n.strip()]
    added = False
    for n in names:
        if re.search(rf"\b{n}\b", s) and n not in have and f"type {n}" not in have:
            have.append(n)
            added = True
    if not added:
        return s
    joined = ",\n  ".join(sorted(set(have)))
    return s[: m.start()] + "import {\n  " + joined + "\n} from 'three';" + s[m.end():]


def main() -> None:
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    is_boost = dst.stem in ("ElectricBoost", "FireBoost", "MagicBoost")

    dst.write_text(fix_specifiers(src.read_text(encoding="utf-8")), encoding="utf-8", newline="")

    subprocess.run([sys.executable, str(ROOT / "vendor/declare-fields.py"), "--force", str(dst)], check=True)
    subprocess.run([sys.executable, str(ROOT / "vendor/type-sync-state.py"), str(dst)], check=True)

    s = dst.read_text(encoding="utf-8")
    s = type_emit_scratch(s)
    s = type_context(s, is_boost)
    s = ensure_three(s, ["Vector3", "Vector4", "Mesh", "InstancedMesh", "ShaderMaterial", "BufferGeometry", "Object3D"])
    dst.write_text(s, encoding="utf-8", newline="")
    print(f"ported {dst.name}")


if __name__ == "__main__":
    main()
