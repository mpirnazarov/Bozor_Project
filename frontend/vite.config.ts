import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => ({
  // mode: "production" da HMR o'chiq — WebSocket xatolari yo'qoladi
  plugins: [react()],
  build: {
    sourcemap: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    hmr: mode === "development",  // production da HMR o'chiq
    port: 3000,
    proxy: {
      "/api": {
        target: process.env.VITE_PROXY_TARGET || "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
}));
