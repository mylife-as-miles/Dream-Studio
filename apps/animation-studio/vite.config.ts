import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { resolve } from "path"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const base = process.env.VITE_BASE_PATH ?? env.VITE_BASE_PATH ?? "/"

  return {
    base,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": resolve(__dirname, "."),
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
