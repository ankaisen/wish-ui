import {
  createProgrammableRuntime,
  createWishList,
  type Compiler,
  type Framework,
  type ProgrammableFiles,
  type ProgrammableRuntime,
  type Wisher,
  type WishList,
  type WishStore,
} from "@wishkit/core";
import type { ApiKeyStore } from "./apiKey";
import { mountPanel } from "./panel";
import { localWishStore } from "./wishStore";

/** The options every framework adapter's createProgrammable() takes. */
export type ProgrammableOptions = {
  /** The programmable folder, usually `import files from "virtual:wishkit/programmable"`. */
  files: ProgrammableFiles;
  /** The file whose default export the root renders. Each adapter has its own default. */
  entry?: string;
  /** Files wishes may import but never change. Defaults to ["capabilities.ts"]. */
  locked?: string[];
  /** Extra packages programmable code may import, by specifier. The framework itself is always included. */
  packages?: Record<string, unknown>;
  compiler?: Compiler;
  /** Turns wishes into changes, e.g. createClaudeWisher() from @wishkit/llm. */
  wisher?: Wisher;
  /** When given, the panel asks the user for an API key and keeps it here. */
  apiKey?: ApiKeyStore;
  /** Where the user's wishes are kept. Defaults to this browser's localStorage. */
  store?: WishStore;
};

/** What an adapter adds: how its framework compiles, renders and is described to the model. */
export type FrameworkSetup = {
  framework: Framework;
  entry: string;
  /** The framework's packages, offered to wishes. */
  packages: Record<string, unknown>;
  /** Modules the compiled code needs that wishes aren't offered. */
  internal?: Record<string, unknown>;
  compiler: Compiler;
};

export type Wishkit = {
  runtime: ProgrammableRuntime;
  wishes: WishList;
  /** Renders the wish panel into `host`. Returns a function that removes it. */
  mountPanel(host: HTMLElement): () => void;
};

/** The framework-neutral part of createProgrammable(): the runtime, the saved wishes and the panel. */
export function createWishkit(options: ProgrammableOptions, setup: FrameworkSetup): Wishkit {
  const runtime = createProgrammableRuntime({
    files: options.files,
    entry: options.entry ?? setup.entry,
    locked: options.locked ?? ["capabilities.ts"],
    framework: setup.framework,
    packages: { ...setup.packages, ...options.packages },
    internal: setup.internal,
    compiler: options.compiler ?? setup.compiler,
  });

  const wishes = createWishList({
    store: options.store ?? localWishStore(),
    sources: options.files.sources,
    apply: (overlay) => runtime.tryApply(overlay),
    current: () => runtime.getSnapshot().overlay,
  });

  return {
    runtime,
    wishes,
    mountPanel: (host) => mountPanel(host, { runtime, wishes, wisher: options.wisher, apiKey: options.apiKey }),
  };
}
