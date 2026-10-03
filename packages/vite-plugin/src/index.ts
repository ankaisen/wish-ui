import type { Plugin } from "vite";

export type ProgrammableOptions = {
  /** The folder end users may reshape, relative to the project root. Defaults to "src/programmable". */
  root?: string;
  /** File types in the folder, without the dot. Defaults to ["ts", "tsx", "vue"]. */
  extensions?: string[];
};

const DEFAULT_EXTENSIONS = ["ts", "tsx", "vue"];

export const VIRTUAL_ID = "virtual:wishkit/programmable";
const RESOLVED_ID = "\0" + VIRTUAL_ID;

export function normalizeRoot(root: string): string {
  return root.replace(/^\.?\/+/, "").replace(/\/+$/, "");
}

/** The virtual module: every file in the root as raw source and as the bundled module, keyed by path in the root. */
export function virtualModuleCode(root: string, extensions: string[] = DEFAULT_EXTENSIONS): string {
  const prefix = `/${normalizeRoot(root)}/`;
  const types = extensions.length === 1 ? extensions[0] : `{${extensions.join(",")}}`;
  const globs = JSON.stringify([`${prefix}**/*.${types}`, `!${prefix}**/*.test.${types}`, `!${prefix}**/*.d.ts`]);
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
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;
  return {
    name: "wishkit:programmable",
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      return id === RESOLVED_ID ? virtualModuleCode(root, extensions) : undefined;
    },
  };
}
