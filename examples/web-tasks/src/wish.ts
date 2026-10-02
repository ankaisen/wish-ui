import { createBrowserClient, createClaudeWisher } from "@wishkit/llm";
import { createProgrammable, localApiKeyStore } from "@wishkit/react";
import files from "virtual:wishkit/programmable";

// The demo runs without a server, so each user brings their own Claude API key.
const apiKey = localApiKeyStore();

export const wish = createProgrammable({
  files,
  apiKey,
  wisher: createClaudeWisher({ client: () => createBrowserClient(apiKey.get() ?? "") }),
});

if (import.meta.env.DEV) {
  // Lets you try a live swap from the browser console, e.g. wish.runtime.apply({ "TaskList.tsx": "..." }).
  Object.assign(window, { wish });
}
