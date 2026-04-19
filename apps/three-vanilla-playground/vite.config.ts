import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, searchForWorkspaceRoot } from "vite";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const workspaceAliases = loadWorkspaceAliases();

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = process.env.VITE_BASE_PATH ?? env.VITE_BASE_PATH ?? "/";

  return {
    base,
    plugins: [tailwindcss()],
    resolve: {
      alias: workspaceAliases,
      dedupe: ["three"]
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      allowedHosts: true,
      fs: {
        allow: [searchForWorkspaceRoot(process.cwd())]
      }
    }
  };
});

function loadWorkspaceAliases() {
  const packagesDir = path.resolve(repoRoot, "packages");
  const aliases = {};

  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const manifestPath = path.join(packagesDir, entry.name, "package.json");
    const sourceEntryPath = path.join(packagesDir, entry.name, "src", "index.ts");

    if (!existsSync(manifestPath) || !existsSync(sourceEntryPath)) {
      continue;
    }

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

    if (typeof manifest.name === "string" && manifest.name.startsWith("@blud/")) {
      aliases[manifest.name] = sourceEntryPath;
    }
  }

  return aliases;
}
