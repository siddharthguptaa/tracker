/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" keeps every asset URL relative, so the build works under
// /tracker/next/ on GitHub Pages, at / locally, and from file-less offline previews.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { target: "es2022", sourcemap: false, chunkSizeWarningLimit: 900 },
  test: {
    environment: "jsdom",
    globals: false,
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/unit/setup.ts"],
    coverage: { reporter: ["text", "lcov"], include: ["src/domain/**", "src/assistant/**"] },
  },
});
