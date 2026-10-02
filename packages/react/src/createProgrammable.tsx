import {
  createEsbuildCompiler,
  createProgrammableRuntime,
  type Compiler,
  type ProgrammableFiles,
  type ProgrammableRuntime,
} from "@wish-ui/core";
import wasmURL from "esbuild-wasm/esbuild.wasm?url";
import * as React from "react";
import { Component, useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import * as jsxRuntime from "react/jsx-runtime";

export type ProgrammableOptions = {
  /** The programmable folder, usually `import files from "virtual:wish-ui/programmable"`. */
  files: ProgrammableFiles;
  /** The file whose default export `<Root />` renders. Defaults to "index.tsx". */
  entry?: string;
  /** Files wishes may import but never change. Defaults to ["capabilities.ts"]. */
  locked?: string[];
  /** Extra packages programmable code may import, by specifier. React is always included. */
  packages?: Record<string, unknown>;
  compiler?: Compiler;
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

  /** Renders the programmable entry, swapping in the user's latest version live. Props pass through. */
  function Root(props: Record<string, unknown>) {
    const snapshot = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot);
    const Entry = snapshot.entry as ComponentType<Record<string, unknown>>;
    return (
      <RenderBoundary key={snapshot.version}>
        <Entry {...props} />
      </RenderBoundary>
    );
  }

  return { runtime, Root };
}
