import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiTarget = process.env.VITE_API_PROXY_TARGET ?? "http://localhost:8080";
const sharedSource = fileURLToPath(
  new URL("../../packages/shared/src/index.ts", import.meta.url),
);
const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@callmind/shared": sharedSource,
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    fs: {
      allow: [workspaceRoot],
    },
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 5173,
  },
});
