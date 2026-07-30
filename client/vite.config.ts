import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { CLIENT_PORT, SERVER_DEV_PORT } from "../shared/constants/ports.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiTarget = `http://127.0.0.1:${SERVER_DEV_PORT}`;

export default defineConfig(({ mode }) => ({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: CLIENT_PORT,
    strictPort: true,
    // Socket.io em dev vai direto à 7001 (useGameConnection) — proxy só para /api
    proxy: {
      "/api": {
        target: apiTarget,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: CLIENT_PORT,
    strictPort: true,
    proxy: {
      "/api": { target: apiTarget },
    },
  },
  build: {
    outDir: path.join(__dirname, "dist"),
    emptyOutDir: true,
    sourcemap: mode === "development",
    target: "es2022",
  },
}));
