import react from "@vitejs/plugin-react";
import programmable from "@wishkit/vite-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), programmable({ root: "src/programmable" })],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
