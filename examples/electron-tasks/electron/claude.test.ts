import { describe, expect, it } from "vitest";
import { forwardToClaude } from "./claude";

const request = {
  url: "https://api.anthropic.com/v1/messages?beta=true",
  method: "POST",
  headers: { "content-type": "application/json", "x-api-key": "from-the-page", "anthropic-dangerous-direct-browser-access": "true" },
  body: "{}",
};

describe("forwardToClaude", () => {
  it("adds the key and drops the page's own key and browser header", async () => {
    let sent: Headers | undefined;
    const response = await forwardToClaude(request, "sk-ant-main", async (_url, init) => {
      sent = new Headers(init?.headers);
      return new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json", "content-encoding": "gzip" } });
    });

    expect(sent?.get("x-api-key")).toBe("sk-ant-main");
    expect(sent?.has("anthropic-dangerous-direct-browser-access")).toBe(false);
    expect(response).toEqual({ status: 200, statusText: "", headers: [["content-type", "application/json"]], body: '{"ok":true}' });
  });

  it("sends nothing anywhere but the Claude Messages API", async () => {
    const fetchImpl = async () => {
      throw new Error("should not be called");
    };
    for (const url of ["https://example.com/v1/messages", "https://api.anthropic.com/v1/files", "http://api.anthropic.com/v1/messages"]) {
      expect((await forwardToClaude({ ...request, url }, "sk-ant-main", fetchImpl)).status).toBe(403);
    }
    expect((await forwardToClaude({ ...request, method: "GET" }, "sk-ant-main", fetchImpl)).status).toBe(403);
  });

  it("answers like the API when no key is set", async () => {
    const response = await forwardToClaude(request, null, async () => new Response());
    expect(response.status).toBe(401);
    expect(JSON.parse(response.body).error.type).toBe("authentication_error");
  });
});
