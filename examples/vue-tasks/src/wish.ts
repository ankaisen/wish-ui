import { createBrowserClient, createClaudeWisher } from "@wishkit/llm";
import { createProgrammable, localApiKeyStore, localWishStore } from "@wishkit/vue";
import files from "virtual:wishkit/programmable";

// The demo runs without a server, so each user brings their own Claude API key.
const apiKey = localApiKeyStore();

export const wish = createProgrammable({
  files,
  apiKey,
  // Its own key, so wishes made in the React demo on the same address don't show up here.
  store: localWishStore("wishkit.vue-tasks.wishes"),
  wisher: createClaudeWisher({ client: () => createBrowserClient(apiKey.get() ?? "") }),
});

if (import.meta.env.DEV) {
  // Lets you try a live swap from the browser console, e.g. wish.runtime.apply({ "TaskList.vue": "..." }).
  Object.assign(window, { wish });
}
