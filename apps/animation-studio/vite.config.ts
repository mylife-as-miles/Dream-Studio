import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { resolve } from "path"
import { createAnimationGameSyncPlugin } from "./server/animation-game-sync-plugin"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const base = process.env.VITE_BASE_PATH ?? env.VITE_BASE_PATH ?? "/"
  const plugins = [react(), tailwindcss(), createAnimationGameSyncPlugin()] as any

  return {
    base,
    plugins,
    resolve: {
      alias: {
        "@": resolve(__dirname, "."),
        "@blud/anim-core": resolve(__dirname, "../../packages/anim-core/src/index.ts"),
        "@blud/anim-exporter": resolve(__dirname, "../../packages/anim-exporter/src/index.ts"),
        "@blud/anim-schema": resolve(__dirname, "../../packages/anim-schema/src/index.ts"),
        "@blud/anim-utils": resolve(__dirname, "../../packages/anim-utils/src/index.ts"),
        "@blud/dev-sync": resolve(__dirname, "../../packages/dev-sync/src/index.ts"),
        "@blud/dev-sync/node": resolve(__dirname, "../../packages/dev-sync/src/node.ts"),
      },
    },
    server: {
      host: "0.0.0.0",
      port: 8082,
      strictPort: true,
      allowedHosts: true,
    },
  }
})
