import Anthropic from "@anthropic-ai/sdk";
import { hasExtension, type Framework, type Overlay, type Wisher, type WishOutcome } from "@wishkit/core";
import { describeRequest, systemPrompt } from "./prompt";

export type ClaudeWisherOptions = {
  /** A client, or a function returning one (e.g. once the user has entered a key). */
  client: Anthropic | (() => Anthropic);
  /** Defaults to "claude-opus-5-5". */
  model?: string;
  /** Thinking effort. Defaults to "medium", which keeps wishes quick. */
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  /** How many times a failing change is sent back to be fixed. Defaults to 2. */
  maxRetries?: number;
  /** Upper bound on model calls for one wish. Defaults to 12. */
  maxTurns?: number;
};

function toolsFor(framework: Framework): Anthropic.Beta.BetaTool[] {
  const example = `"TaskList${framework.extensions[0] ?? ".ts"}"`;
  return [
    {
      name: "read_file",
      description: "Read a file in the programmable folder. Returns its current source.",
      strict: true,
      input_schema: {
        type: "object",
        properties: { path: { type: "string", description: `Path relative to the folder, e.g. ${example}.` } },
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      name: "write_file",
      description:
        "Create or replace a file in the programmable folder with its complete new source. Changes go live together when you finish.",
      strict: true,
      input_schema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: `Path relative to the folder, ending in ${framework.extensions.join(" or ")}, e.g. ${example}.`,
          },
          content: { type: "string", description: "The file's complete source." },
        },
        required: ["path", "content"],
        additionalProperties: false,
      },
    },
    {
      name: "decline",
      description:
        "Say the wish can't be done inside the app's boundary. The reason is shown to the user, so say what is missing in plain words.",
      strict: true,
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
        additionalProperties: false,
      },
    },
  ];
}

/** A relative path inside the folder: no "." or ".." segments, no leading slash. */
const PATH_PATTERN = /^(?!.*(?:^|\/)\.\.?(?:\/|$))[\w.-]+(?:\/[\w.-]+)*$/;

function textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join(" ")
    .trim();
}

/**
 * A client that calls the Claude API straight from the browser with the user's own key.
 * The key is visible to the page, so use this only with a key the user owns and entered.
 */
export function createBrowserClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

/** A Wisher that asks Claude to rewrite the programmable folder. */
export function createClaudeWisher(options: ClaudeWisherOptions): Wisher {
  const model = options.model ?? "claude-opus-5-5";
  const maxRetries = options.maxRetries ?? 2;
  const maxTurns = options.maxTurns ?? 12;

  return async ({ text, selection, workspace, onProgress, signal }): Promise<WishOutcome> => {
    const client = typeof options.client === "function" ? options.client() : options.client;
    const { framework } = workspace;
    const system = systemPrompt(framework);
    const tools = toolsFor(framework);
    const messages: Anthropic.Beta.BetaMessageParam[] = [
      { role: "user", content: describeRequest(text, selection, workspace) },
    ];
    const written: Record<string, string> = {};
    let retries = 0;

    for (let turn = 0; turn < maxTurns; turn++) {
      onProgress?.(turn === 0 ? "Thinking about your wish" : "Working on it");
      let response: Anthropic.Beta.BetaMessage;
      try {
        response = await client.beta.messages.create(
          {
            model,
            max_tokens: 16000,
            system,
            tools,
            messages,
            output_config: { effort: options.effort ?? "medium" },
            // On a safety decline, the API retries on a suitable fallback model in the same call.
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
          },
          { signal },
        );
      } catch (error) {
        if (error instanceof Anthropic.AuthenticationError) return { status: "failed", error: "The API key was rejected." };
        if (error instanceof Anthropic.RateLimitError) return { status: "failed", error: "Too many requests right now. Try again shortly." };
        if (error instanceof Anthropic.APIError) return { status: "failed", error: `The model call failed (${error.status ?? "network"}).` };
        throw error;
      }

      if (response.stop_reason === "refusal") return { status: "failed", error: "The model declined this request." };
      if (response.stop_reason === "max_tokens") return { status: "failed", error: "The change was too large to finish in one go." };

      // Append the whole turn unchanged: the history stays append-only.
      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "pause_turn") continue;

      const toolUses = response.content.filter(
        (block): block is Anthropic.Beta.BetaToolUseBlock => block.type === "tool_use",
      );

      if (toolUses.length > 0) {
        const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
        for (const use of toolUses) {
          const input = use.input as Record<string, string>;
          if (use.name === "decline") return { status: "declined", reason: input.reason ?? "This can't be done here." };
          if (use.name === "read_file") {
            onProgress?.(`Reading ${input.path}`);
            const source = input.path ? (written[input.path] ?? workspace.readFile(input.path)) : undefined;
            results.push(
              source === undefined
                ? { type: "tool_result", tool_use_id: use.id, is_error: true, content: `No file named ${input.path}.` }
                : { type: "tool_result", tool_use_id: use.id, content: source },
            );
          } else if (use.name === "write_file") {
            const path = input.path ?? "";
            if (!PATH_PATTERN.test(path) || !hasExtension(framework, path)) {
              results.push({
                type: "tool_result",
                tool_use_id: use.id,
                is_error: true,
                content: `Invalid path "${path}". Use a ${framework.extensions.join(" or ")} path inside the folder.`,
              });
            } else if (workspace.isLocked(path)) {
              results.push({ type: "tool_result", tool_use_id: use.id, is_error: true, content: `${path} is locked and cannot be changed.` });
            } else {
              onProgress?.(`Writing ${path}`);
              written[path] = input.content ?? "";
              results.push({ type: "tool_result", tool_use_id: use.id, content: "Saved." });
            }
          } else {
            results.push({ type: "tool_result", tool_use_id: use.id, is_error: true, content: `Unknown tool ${use.name}.` });
          }
        }
        messages.push({ role: "user", content: results });
        continue;
      }

      // end_turn: try the change.
      if (Object.keys(written).length === 0) {
        return { status: "failed", error: textOf(response.content) || "No change was made." };
      }
      onProgress?.("Checking the change");
      const overlay: Overlay = { ...workspace.getSnapshot().overlay, ...written };
      const result = await workspace.tryApply(overlay);
      if (result.ok) {
        return { status: "applied", summary: textOf(response.content) || "Changed the app", files: { ...written } };
      }
      if (retries >= maxRetries) {
        return { status: "failed", error: `The change didn't pass its checks: ${result.errors.join("; ")}` };
      }
      retries++;
      onProgress?.("Fixing a problem");
      messages.push({
        role: "user",
        content: `The change failed its checks and was not applied:\n${result.errors.map((error) => `- ${error}`).join("\n")}\nFix the files with write_file, then finish again.`,
      });
    }
    return { status: "failed", error: "This took too many steps. Try a smaller wish." };
  };
}
