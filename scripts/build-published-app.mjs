import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const editorDist = path.join(repoRoot, "apps", "editor", "dist");
const animationDist = path.join(repoRoot, "apps", "animation-editor", "dist");
const characterDist = path.join(repoRoot, "apps", "animation-studio", "dist");
const vanillaDist = path.join(repoRoot, "apps", "three-vanilla-playground", "dist");
const publishedAnimationDir = path.join(editorDist, "animation");
const publishedCharacterDir = path.join(editorDist, "character");
const publishedVanillaDir = path.join(editorDist, "vanilla");

run("npm run build -w @blud/editor");
run("npm run build -w animation-editor", {
  VITE_BASE_PATH: "/animation/"
});
run("npm run build -w animation-studio", {
  VITE_BASE_PATH: "/character/"
});
run("npm run build -w @blud/three-vanilla-playground", {
  VITE_BASE_PATH: "/vanilla/"
});

await fs.rm(publishedAnimationDir, { force: true, recursive: true });
await fs.rm(publishedCharacterDir, { force: true, recursive: true });
await fs.rm(publishedVanillaDir, { force: true, recursive: true });
await fs.cp(animationDist, publishedAnimationDir, { recursive: true });
await fs.cp(characterDist, publishedCharacterDir, { recursive: true });
await fs.cp(vanillaDist, publishedVanillaDir, { recursive: true });

console.log("Published build ready:");
console.log("  / -> editor");
console.log("  /animation/ -> animation editor");
console.log("  /character/ -> character editor");
console.log("  /vanilla/ -> three-vanilla playground");

function run(command, extraEnv = {}) {
  execSync(command, {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...extraEnv
    },
    stdio: "inherit"
  });
}
