import type Anthropic from "@anthropic-ai/sdk";
import type { BuildResult, Overlay, Workspace } from "@wish-ui/core";
import { describe, expect, it } from "vitest";
import { createClaudeWisher } from "./claude";

type Block = Record<string, unknown>;

function reply(stop_reason: string, ...content: Block[]) {
  return { stop_reason, content };
}
const text = (value: string) => ({ type: "text", text: value });
let ids = 0;
const tool = (name: string, input: Record<string, string>) => ({ type: "tool_use", id: `tu_${ids++}`, name, input });

/** A fake client that returns scripted responses and records each request. */
function fakeClient(...responses: ReturnType<typeof reply>[]) {
  const requests: { messages: { role: string; content: unknown }[] }[] = [];
  const client = {
    beta: {
      messages: {
        async create(params: { messages: { role: string; content: unknown }[] }) {
          requests.push(structuredClone(params));
          const next = responses.shift();
          if (!next) throw new Error("no scripted response left");
          return next;
        },
      },
    },
  } as unknown as Anthropic;
  return { client, requests };
}

function fakeWorkspace(results: BuildResult[] = [{ ok: true }]) {
  const applied: Overlay[] = [];
  const files: Record<string, string> = {
    "index.tsx": "export default function App() { return null; }",
    "capabilities.ts": "export const tasks = {};",
  };
  const workspace: Workspace = {
    listFiles: () => Object.keys(files).sort(),
    readFile: (path) => files[path],
    isLocked: (path) => path === "capabilities.ts",
    listPackages: () => ["react"],
    getSnapshot: () => ({ overlay: {} }),
    async tryApply(overlay) {
      applied.push(overlay);
      return results.shift() ?? { ok: true };
    },
  };
  return { workspace, applied };
}

describe("Claude wisher", () => {
  it("applies the written files and returns the closing sentence as the summary", async () => {
    const { client, requests } = fakeClient(
      reply("tool_use", tool("write_file", { path: "index.tsx", content: "export default () => <b>hi</b>;" })),
      reply("end_turn", text("Made the greeting bold")),
    );
    const { workspace, applied } = fakeWorkspace();

    const outcome = await createClaudeWisher({ client })({
      text: "make it bold",
      selection: { file: "index.tsx", line: 1, tag: "p", text: "hi" },
      workspace,
    });

    expect(outcome).toEqual({
      status: "applied",
      summary: "Made the greeting bold",
      files: { "index.tsx": "export default () => <b>hi</b>;" },
    });
    expect(applied).toEqual([{ "index.tsx": "export default () => <b>hi</b>;" }]);
    const first = requests[0]!.messages[0]!.content as string;
    expect(first).toContain("Wish: make it bold");
    expect(first).toContain("selected a <p> rendered at index.tsx:1");
    expect(first).toContain("- capabilities.ts (locked)");
    expect(first).toContain('<file path="index.tsx">');
  });

  it("sends failed checks back and applies the fixed version", async () => {
    const { client, requests } = fakeClient(
      reply("tool_use", tool("write_file", { path: "index.tsx", content: "broken" })),
      reply("end_turn", text("Done")),
      reply("tool_use", tool("write_file", { path: "index.tsx", content: "fixed" })),
      reply("end_turn", text("Fixed it")),
    );
    const { workspace } = fakeWorkspace([{ ok: false, errors: ["index.tsx: line 1: oops"] }, { ok: true }]);

    const outcome = await createClaudeWisher({ client })({ text: "x", workspace });

    expect(outcome).toMatchObject({ status: "applied", files: { "index.tsx": "fixed" } });
    expect(requests[2]!.messages.at(-1)!.content).toContain("- index.tsx: line 1: oops");
  });

  it("gives up after the retries are spent", async () => {
    const { client } = fakeClient(
      reply("tool_use", tool("write_file", { path: "index.tsx", content: "a" })),
      reply("end_turn", text("Done")),
      reply("tool_use", tool("write_file", { path: "index.tsx", content: "b" })),
      reply("end_turn", text("Done")),
    );
    const { workspace } = fakeWorkspace([
      { ok: false, errors: ["first"] },
      { ok: false, errors: ["second"] },
    ]);
    const outcome = await createClaudeWisher({ client, maxRetries: 1 })({ text: "x", workspace });
    expect(outcome).toEqual({ status: "failed", error: "The change didn't pass its checks: second" });
  });

  it("passes a decline through to the user", async () => {
    const { client } = fakeClient(reply("tool_use", tool("decline", { reason: "There is no capability for due dates." })));
    const outcome = await createClaudeWisher({ client })({ text: "add due dates", workspace: fakeWorkspace().workspace });
    expect(outcome).toEqual({ status: "declined", reason: "There is no capability for due dates." });
  });

  it("refuses writes to locked files and paths outside the folder", async () => {
    const { client, requests } = fakeClient(
      reply(
        "tool_use",
        tool("write_file", { path: "capabilities.ts", content: "x" }),
        tool("write_file", { path: "../store.ts", content: "x" }),
      ),
      reply("end_turn", text("Gave up")),
    );
    const outcome = await createClaudeWisher({ client })({ text: "x", workspace: fakeWorkspace().workspace });

    const results = requests[1]!.messages.at(-1)!.content as { is_error: boolean; content: string }[];
    expect(results.map((result) => [result.is_error, result.content])).toEqual([
      [true, "capabilities.ts is locked and cannot be changed."],
      [true, 'Invalid path "../store.ts". Use a .ts or .tsx path inside the folder.'],
    ]);
    expect(outcome).toEqual({ status: "failed", error: "Gave up" });
  });

  it("reports a refusal", async () => {
    const { client } = fakeClient(reply("refusal"));
    const outcome = await createClaudeWisher({ client })({ text: "x", workspace: fakeWorkspace().workspace });
    expect(outcome).toEqual({ status: "failed", error: "The model declined this request." });
  });
});
