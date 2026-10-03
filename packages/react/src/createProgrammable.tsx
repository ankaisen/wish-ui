import { createEsbuildCompiler } from "@wishkit/core";
import { createWishkit, ROOT_ATTRIBUTE, type ProgrammableOptions } from "@wishkit/dom";
import wasmURL from "esbuild-wasm/esbuild.wasm?url";
import * as React from "react";
import { Component, useEffect, useRef, useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { react, sourceMappedJsx } from "./framework";

export type { ProgrammableOptions };

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
  const { runtime, wishes, mountPanel } = createWishkit(options, {
    framework: react,
    entry: "index.tsx",
    packages: { react: React, "react/jsx-runtime": jsxRuntime },
    internal: { "react/jsx-dev-runtime": sourceMappedJsx(jsxRuntime) },
    compiler: createEsbuildCompiler({ wasmURL }),
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
    // Brings back the user's saved wishes once something is mounted to render them.
    useEffect(() => {
      void wishes.ready();
    }, []);
    return (
      <div {...{ [ROOT_ATTRIBUTE]: "" }} style={{ display: "contents" }}>
        <RenderBoundary key={snapshot.version} onError={(error) => runtime.reportRender(snapshot.version, error)}>
          <Entry {...props} />
          <Rendered version={snapshot.version} />
        </RenderBoundary>
      </div>
    );
  }

  /** The floating panel where users select part of the app and make wishes. */
  function Panel() {
    const host = useRef<HTMLDivElement>(null);
    useEffect(() => mountPanel(host.current!), []);
    return <div ref={host} style={{ display: "contents" }} />;
  }

  return { runtime, wishes, Root, Panel };
}
