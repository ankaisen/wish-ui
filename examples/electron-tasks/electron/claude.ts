import type { ClaudeRequest, ClaudeResponse } from "./api";

const CLAUDE_ORIGIN = "https://api.anthropic.com";

/** Headers the main process sets itself, or that only make sense for requests sent from a browser. */
const DROPPED_HEADERS = ["authorization", "x-api-key", "anthropic-dangerous-direct-browser-access", "host", "content-length"];

function errorResponse(status: number, type: string, message: string): ClaudeResponse {
  return {
    status,
    statusText: type,
    headers: [["content-type", "application/json"]],
    body: JSON.stringify({ type: "error", error: { type, message } }),
  };
}

/**
 * Sends a renderer's Claude API request with the key added. Only Messages API calls to the
 * Claude API go out, so code running in the renderer can't use this to reach anything else.
 */
export async function forwardToClaude(
  request: ClaudeRequest,
  apiKey: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<ClaudeResponse> {
  const url = new URL(request.url);
  if (url.origin !== CLAUDE_ORIGIN || !url.pathname.startsWith("/v1/messages") || request.method !== "POST") {
    return errorResponse(403, "permission_error", "Only Claude API message requests can be sent from the app.");
  }
  if (!apiKey) return errorResponse(401, "authentication_error", "No Claude API key is set.");

  const headers = new Headers(request.headers);
  for (const name of DROPPED_HEADERS) headers.delete(name);
  headers.set("x-api-key", apiKey);

  const response = await fetchImpl(url, { method: "POST", headers, body: request.body });
  return {
    status: response.status,
    statusText: response.statusText,
    // The body is passed on already decoded, so its encoding and length no longer apply.
    headers: [...response.headers].filter(([name]) => name !== "content-encoding" && name !== "content-length"),
    body: await response.text(),
  };
}
