import react from "@vitejs/plugin-react";
import programmable from "@wishkit/vite-plugin";
import { defineConfig } from "vitest/config";

// Builds the renderer: the page the window shows.
export default defineConfig({
  plugins: [react(), programmable({ root: "src/programmable" })],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  build: {
    outDir: "dist/renderer",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
