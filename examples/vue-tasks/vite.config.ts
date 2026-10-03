import vue from "@vitejs/plugin-vue";
import programmable from "@wishkit/vite-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [vue(), programmable({ root: "src/programmable" })],
  resolve: {
    dedupe: ["vue"],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
