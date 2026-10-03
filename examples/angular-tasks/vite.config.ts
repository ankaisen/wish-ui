import programmable from "@wishkit/vite-plugin";
import { defineConfig } from "vitest/config";

// No Angular build plugin: the demo runs Angular in JIT mode, the same way wishes are compiled.
export default defineConfig({
  plugins: [programmable({ root: "src/programmable", extensions: ["ts"] })],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
