import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],

  // Prevent Vite from obscuring Rust errors
  clearScreen: false,

  server: {
    port: 5173,
    // Tauri expects a fixed port, fail if it can't be obtained
    strictPort: true,
    // Use the Tauri dev host if it's set
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 5183,
        }
      : undefined,
    watch: {
      // Tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  // Env variables starting with VITE_ are exposed to the frontend
  envPrefix: ["VITE_", "TAURI_ENV_*"],

  build: {
    // Tauri uses Chromium on macOS and WebView2 on Windows
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari16",
    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    // Minify for release builds
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
  },
});
