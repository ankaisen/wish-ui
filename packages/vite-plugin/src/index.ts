import type { Plugin } from "vite";

export type ProgrammableOptions = {
  /** The folder end users may reshape, relative to the project root. Defaults to "src/programmable". */
  root?: string;
};

export const VIRTUAL_ID = "virtual:wish-ui/programmable";
const RESOLVED_ID = "\0" + VIRTUAL_ID;

export function normalizeRoot(root: string): string {
  return root.replace(/^\.?\/+/, "").replace(/\/+$/, "");
}

/** The virtual module: every file in the root as raw source and as the bundled module, keyed by path in the root. */
export function virtualModuleCode(root: string): string {
  const prefix = `/${normalizeRoot(root)}/`;
  const globs = JSON.stringify([`${prefix}**/*.{ts,tsx}`, `!${prefix}**/*.test.{ts,tsx}`, `!${prefix}**/*.d.ts`]);
  return [
    `const prefix = ${JSON.stringify(prefix)};`,
    `const strip = (files) => Object.fromEntries(Object.entries(files).map(([path, value]) => [path.slice(prefix.length), value]));`,
    `const sources = import.meta.glob(${globs}, { query: "?raw", import: "default", eager: true });`,
    `const modules = import.meta.glob(${globs}, { eager: true });`,
    `export default { root: ${JSON.stringify(normalizeRoot(root))}, sources: strip(sources), modules: strip(modules) };`,
  ].join("\n");
}

export default function programmable(options: ProgrammableOptions = {}): Plugin {
  const root = options.root ?? "src/programmable";
  return {
    name: "wish-ui:programmable",
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      return id === RESOLVED_ID ? virtualModuleCode(root) : undefined;
    },
  };
}
