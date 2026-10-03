import type { Framework } from "@wishkit/core";

export const react: Framework = {
  name: "React",
  extensions: [".tsx", ".ts"],
  guidance: `- Write React function components and hooks in TypeScript, in .tsx files.
- The entry file's default export is what the app renders. Keep it a React component.`,
};

type JsxRuntime = { jsx: Function; jsxs: Function; Fragment: unknown };

/**
 * The JSX dev runtime compiled programmable files import. It wraps jsx() so every DOM element
 * carries the file and line that created it, which is what the user selects.
 */
export function sourceMappedJsx(jsxRuntime: JsxRuntime) {
  return {
    Fragment: jsxRuntime.Fragment,
    jsxDEV(
      type: unknown,
      props: Record<string, unknown>,
      key: unknown,
      isStaticChildren: boolean,
      source?: { fileName: string; lineNumber: number },
    ) {
      if (typeof type === "string" && source) {
        props = { ...props, "data-source-file": source.fileName, "data-source-line": source.lineNumber };
      }
      // jsxs marks children written inline (not from a .map), so React doesn't ask them for keys.
      return (isStaticChildren ? jsxRuntime.jsxs : jsxRuntime.jsx)(type, props, key);
    },
  };
}
