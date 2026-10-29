import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: "src/web",
  publicDir: "../../public",
  build: { outDir: "../../dist/web", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8080",
      "/media": "http://localhost:8080",
      "/ws": { target: "ws://localhost:8080", ws: true },
    },
  },
});
