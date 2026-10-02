import { describe, expect, it } from "vitest";
import { createEsbuildCompiler } from "./compiler";
import { createProgrammableRuntime, type ProgrammableFiles } from "./runtime";

type Element = { type: unknown; props: Record<string, unknown> };

const jsxRuntime = {
  Fragment: Symbol("Fragment"),
  jsx: (type: unknown, props: Record<string, unknown>): Element => ({ type, props }),
  jsxs: (type: unknown, props: Record<string, unknown>): Element => ({ type, props }),
};

const capabilities = { greeting: () => "hello" };

const files: ProgrammableFiles = {
  sources: {
    "index.tsx": 'import { Label } from "./Label";\nexport default function App() { return <Label />; }\n',
    "Label.tsx": 'import { greeting } from "./capabilities";\nexport function Label() { return <span>{greeting()}</span>; }\n',
    "capabilities.ts": 'export const greeting = () => "hello";\n',
  },
  modules: {
    "index.tsx": { default: () => "bundled" },
    "Label.tsx": {},
    "capabilities.ts": capabilities,
  },
};

const compiler = createEsbuildCompiler();

function createRuntime() {
  return createProgrammableRuntime({
    files,
    entry: "index.tsx",
    locked: ["capabilities.ts"],
    packages: { "react/jsx-runtime": jsxRuntime },
    compiler,
  });
}

/** Renders the entry one level deep: App -> <Label /> -> Label's element. */
function render(runtime: ReturnType<typeof createRuntime>): Element {
  const app = runtime.getSnapshot().entry as () => Element;
  const label = app();
  return (label.type as () => Element)();
}

describe("programmable runtime", () => {
  it("starts with the bundled entry", () => {
    const runtime = createRuntime();
    expect((runtime.getSnapshot().entry as () => string)()).toBe("bundled");
    expect(runtime.getSnapshot().version).toBe(0);
  });

  it("swaps in an overlay and notifies subscribers", async () => {
    const runtime = createRuntime();
    let notified = 0;
    runtime.subscribe(() => notified++);

    const result = await runtime.apply({
      "Label.tsx": 'import { greeting } from "./capabilities";\nexport function Label() { return <b>{greeting().toUpperCase()}</b>; }\n',
    });

    expect(result).toEqual({ ok: true });
    expect(notified).toBe(1);
    const element = render(runtime);
    expect(element.type).toBe("b");
    expect(element.props.children).toBe("HELLO");
    expect(runtime.readFile("Label.tsx")).toContain("toUpperCase");
  });

  it("tags DOM elements with their source file and line", async () => {
    const runtime = createRuntime();
    await runtime.apply({});
    expect(render(runtime).props).toMatchObject({ "data-source-file": "Label.tsx", "data-source-line": 2 });
  });

  it("shares the host's capabilities module instead of recompiling it", async () => {
    const shared = { greeting: () => "from the host" };
    const runtime = createProgrammableRuntime({
      files: { ...files, modules: { ...files.modules, "capabilities.ts": shared } },
      entry: "index.tsx",
      locked: ["capabilities.ts"],
      packages: { "react/jsx-runtime": jsxRuntime },
      compiler,
    });
    await runtime.apply({});
    expect(render(runtime).props.children).toBe("from the host");
  });

  it("rejects imports that reach outside the programmable folder", async () => {
    const runtime = createRuntime();
    const result = await runtime.apply({
      "Label.tsx": 'import { db } from "../store";\nexport function Label() { return <span>{db}</span>; }\n',
    });
    expect(result).toEqual({
      ok: false,
      errors: ['Label.tsx: "../store" is outside the programmable folder or does not exist'],
    });
    expect(runtime.getSnapshot().version).toBe(0);
  });

  it("rejects packages that were not approved", async () => {
    const result = await createRuntime().apply({
      "Label.tsx": 'import fs from "node:fs";\nexport function Label() { return <span>{String(fs)}</span>; }\n',
    });
    expect(result).toEqual({ ok: false, errors: ['Label.tsx: "node:fs" is not an approved package'] });
  });

  it("refuses to change a locked file", async () => {
    const result = await createRuntime().apply({ "capabilities.ts": "export const greeting = () => 'hacked';" });
    expect(result).toEqual({ ok: false, errors: ["capabilities.ts: this file is locked and cannot be changed"] });
  });

  it("reports compile errors and keeps the previous version", async () => {
    const runtime = createRuntime();
    await runtime.apply({});
    const result = await runtime.apply({ "Label.tsx": "export function Label() { return <span>; }" });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors[0]).toMatch(/^Label\.tsx: line 1: /);
    expect(runtime.getSnapshot().version).toBe(1);
  });

  it("reports errors thrown while loading", async () => {
    const result = await createRuntime().apply({
      "Label.tsx": 'throw new Error("boom");\nexport function Label() { return null; }\n',
    });
    expect(result).toEqual({ ok: false, errors: ["Error while loading: boom"] });
  });
});

describe("prepare", () => {
  it("switches to source-mapped modules once", async () => {
    const runtime = createRuntime();
    expect(await runtime.prepare()).toEqual({ ok: true });
    expect(runtime.getSnapshot().version).toBe(1);
    expect(render(runtime).props["data-source-file"]).toBe("Label.tsx");
    await runtime.prepare();
    expect(runtime.getSnapshot().version).toBe(1);
  });
});
