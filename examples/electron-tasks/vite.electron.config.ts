import { builtinModules } from "node:module";
import { defineConfig } from "vite";

// Builds the main process and the preload script as CommonJS for Electron.
export default defineConfig({
  build: {
    outDir: "dist/main",
    emptyOutDir: true,
    target: "node22",
    minify: false,
    lib: {
      entry: { main: "electron/main.ts", preload: "electron/preload.ts" },
      formats: ["cjs"],
      fileName: (_format, name) => `${name}.cjs`,
    },
    rolldownOptions: {
      external: ["electron", ...builtinModules, ...builtinModules.map((name) => `node:${name}`)],
    },
  },
});
