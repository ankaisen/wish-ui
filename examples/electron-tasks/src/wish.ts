import Anthropic from "@anthropic-ai/sdk";
import { textWishStore } from "@wishkit/core";
import { createClaudeWisher } from "@wishkit/llm";
import { createProgrammable, type ApiKeyStore } from "@wishkit/react";
import files from "virtual:wishkit/programmable";

const { desktop } = window;

// The key never reaches this page. The panel only learns whether one is set.
let hasKey = desktop.apiKey.has;
const apiKey: ApiKeyStore = {
  description: desktop.apiKey.description,
  get: () => (hasKey ? "kept by the main process" : null),
  set(key) {
    hasKey = Boolean(key);
    void desktop.apiKey.set(key);
  },
};

/** Sends Claude API requests through the main process, which adds the key. */
async function fetchThroughMain(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const response = await desktop.claudeFetch({
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers),
    body: request.body ? await request.text() : null,
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

const client = new Anthropic({ apiKey: "added-by-the-main-process", fetch: fetchThroughMain, dangerouslyAllowBrowser: true });

export const wish = createProgrammable({
  files,
  apiKey,
  store: textWishStore(desktop.wishes),
  wisher: createClaudeWisher({ client }),
});
