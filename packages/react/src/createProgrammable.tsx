import {
  createEsbuildCompiler,
  createProgrammableRuntime,
  type Compiler,
  type ProgrammableFiles,
  type ProgrammableRuntime,
  type Wisher,
} from "@wishkit/core";
import wasmURL from "esbuild-wasm/esbuild.wasm?url";
import * as React from "react";
import { Component, useEffect, useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import type { ApiKeyStore } from "./apiKey";
import { Panel as WishPanel } from "./Panel";

export type ProgrammableOptions = {
  /** The programmable folder, usually `import files from "virtual:wishkit/programmable"`. */
  files: ProgrammableFiles;
  /** The file whose default export `<Root />` renders. Defaults to "index.tsx". */
  entry?: string;
  /** Files wishes may import but never change. Defaults to ["capabilities.ts"]. */
  locked?: string[];
  /** Extra packages programmable code may import, by specifier. React is always included. */
  packages?: Record<string, unknown>;
  compiler?: Compiler;
  /** Turns wishes into changes, e.g. createClaudeWisher() from @wishkit/llm. */
  wisher?: Wisher;
  /** When given, the panel asks the user for an API key and keeps it here. */
  apiKey?: ApiKeyStore;
};

type BoundaryProps = { children: ReactNode; onError?: (error: Error) => void };

class RenderBoundary extends Component<BoundaryProps, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.error) {
      return <div role="alert">This part of the app failed to render: {this.state.error.message}</div>;
    }
    return this.props.children;
  }
}

export function createProgrammable(options: ProgrammableOptions) {
  const runtime: ProgrammableRuntime = createProgrammableRuntime({
    files: options.files,
    entry: options.entry ?? "index.tsx",
    locked: options.locked ?? ["capabilities.ts"],
    packages: { react: React, "react/jsx-runtime": jsxRuntime, ...options.packages },
    compiler: options.compiler ?? createEsbuildCompiler({ wasmURL }),
  });

  /** Tells the runtime a version rendered, so tryApply() can keep it. */
  function Rendered({ version }: { version: number }) {
    useEffect(() => runtime.reportRender(version), [version]);
    return null;
  }

  /** Renders the programmable entry, swapping in the user's latest version live. Props pass through. */
  function Root(props: Record<string, unknown>) {
    const snapshot = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot);
    const Entry = snapshot.entry as ComponentType<Record<string, unknown>>;
    return (
      <div data-wish-root="" style={{ display: "contents" }}>
        <RenderBoundary key={snapshot.version} onError={(error) => runtime.reportRender(snapshot.version, error)}>
          <Entry {...props} />
          <Rendered version={snapshot.version} />
        </RenderBoundary>
      </div>
    );
  }

  /** The floating panel where users select part of the app and make wishes. */
  function Panel() {
    return <WishPanel runtime={runtime} wisher={options.wisher} apiKey={options.apiKey} />;
  }

  return { runtime, Root, Panel };
}
