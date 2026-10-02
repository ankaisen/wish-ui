import { createProgrammable } from "@wish-ui/react";
import files from "virtual:wish-ui/programmable";

export const wish = createProgrammable({ files });

if (import.meta.env.DEV) {
  // Lets you try a live swap from the browser console, e.g. wish.runtime.apply({ "TaskList.tsx": "..." }).
  Object.assign(window, { wish });
}
