import type { Framework } from "@wishkit/core";

export const vue: Framework = {
  name: "Vue",
  extensions: [".vue", ".ts"],
  guidance: `- Write Vue 3 single-file components (.vue) with <script setup lang="ts"> and a <template>, and plain .ts modules for shared code.
- Import components with their .vue extension, e.g. import TaskList from "./TaskList.vue".
- Declare the types defineProps and defineEmits use in the same file.
- The entry file's default export is what the app renders. Keep it a Vue component.
- For styles, use <style scoped> with plain CSS (no preprocessors), inline styles, or existing class names.`,
};
