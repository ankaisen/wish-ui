import { createBrowserClient, createClaudeWisher } from "@wishkit/llm";
import { createProgrammable, localApiKeyStore, localWishStore } from "@wishkit/angular";
import files from "virtual:wishkit/programmable";

// The demo runs without a server, so each user brings their own Claude API key.
const apiKey = localApiKeyStore();

export const wish = createProgrammable({
  files,
  apiKey,
  // Its own key, so wishes made in the other demos on the same address don't show up here.
  store: localWishStore("wishkit.angular-tasks.wishes"),
  wisher: createClaudeWisher({ client: () => createBrowserClient(apiKey.get() ?? "") }),
});

if (import.meta.env.DEV) {
  // Lets you try a live swap from the browser console, e.g. wish.runtime.apply({ "TaskList.ts": "..." }).
  Object.assign(window, { wish });
}
