import { CompileError, type Compiler } from "./compiler";
import { isRelative, resolveFile } from "./paths";

/** The programmable folder as the host app was built: raw sources plus the bundled modules. */
export type ProgrammableFiles = {
  /** File path relative to the root -> source text. */
  sources: Record<string, string>;
  /** File path relative to the root -> the module the host app bundled. */
  modules: Record<string, unknown>;
};

/** A user's changed files: path relative to the root -> new source text. */
export type Overlay = Record<string, string>;

export type RuntimeOptions = {
  files: ProgrammableFiles;
  /** The file whose default export is rendered, e.g. "index.tsx". */
  entry: string;
  /** Files a wish may import but never change, e.g. the capabilities module. */
  locked: string[];
  /** Packages programmable code may import, by specifier. Must include "react/jsx-runtime". */
  packages: Record<string, unknown>;
  compiler: Compiler;
};

export type BuildResult = { ok: true } | { ok: false; errors: string[] };

type Snapshot = {
  overlay: Overlay;
  /** The entry module's default export. */
  entry: unknown;
  /** Bumped on every swap so views can remount. */
  version: number;
};

const JSX_DEV_RUNTIME = "react/jsx-dev-runtime";

type JsxRuntime = { jsx: Function; jsxs: Function; Fragment: unknown };

const IMPORT_PATTERN = /\brequire\(\s*["']([^"']+)["']\s*\)/g;

export function findImports(compiled: string): string[] {
  return [...compiled.matchAll(IMPORT_PATTERN)].map((match) => match[1]!);
}

/** Wraps jsx() so every DOM element carries the file and line that created it. */
function sourceMappedJsx(jsxRuntime: JsxRuntime) {
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

export function createProgrammableRuntime(options: RuntimeOptions) {
  const { files, entry, compiler } = options;
  const locked = new Set(options.locked);
  const jsxRuntime = options.packages["react/jsx-runtime"] as JsxRuntime | undefined;
  if (!jsxRuntime) throw new Error('packages must include "react/jsx-runtime"');
  const packages: Record<string, unknown> = { ...options.packages, [JSX_DEV_RUNTIME]: sourceMappedJsx(jsxRuntime) };

  const bundledEntry = (files.modules[entry] as { default?: unknown } | undefined)?.default;
  if (bundledEntry === undefined) throw new Error(`${entry} has no default export`);

  let snapshot: Snapshot = { overlay: {}, entry: bundledEntry, version: 0 };
  const listeners = new Set<() => void>();

  /** Compiles base sources with the overlay on top, checks every import, and evaluates the entry. */
  async function build(overlay: Overlay): Promise<{ ok: true; entry: unknown } | { ok: false; errors: string[] }> {
    const errors: string[] = [];
    for (const path of Object.keys(overlay)) {
      if (locked.has(path)) errors.push(`${path}: this file is locked and cannot be changed`);
    }
    if (errors.length) return { ok: false, errors };

    const sources = { ...files.sources, ...overlay };
    const paths = new Set(Object.keys(sources));
    const compiled = new Map<string, string>();

    await Promise.all(
      Object.entries(sources)
        .filter(([path]) => !locked.has(path))
        .map(async ([path, source]) => {
          try {
            compiled.set(path, await compiler.compile(path, source));
          } catch (error) {
            errors.push(error instanceof CompileError ? error.message : `${path}: ${String(error)}`);
          }
        }),
    );

    for (const [path, code] of compiled) {
      for (const specifier of findImports(code)) {
        if (isRelative(specifier)) {
          if (resolveFile(path, specifier, paths) === null) {
            errors.push(`${path}: "${specifier}" is outside the programmable folder or does not exist`);
          }
        } else if (!(specifier in packages)) {
          errors.push(`${path}: "${specifier}" is not an approved package`);
        }
      }
    }
    if (errors.length) return { ok: false, errors: errors.sort() };

    const cache = new Map<string, { exports: unknown }>();

    function load(path: string): unknown {
      if (locked.has(path)) return files.modules[path];
      const cached = cache.get(path);
      if (cached) return cached.exports;
      const module = { exports: {} as unknown };
      cache.set(path, module);
      const require = (specifier: string) =>
        isRelative(specifier) ? load(resolveFile(path, specifier, paths)!) : packages[specifier];
      new Function("require", "module", "exports", compiled.get(path)!)(require, module, module.exports);
      return module.exports;
    }

    try {
      const entryModule = load(entry) as { default?: unknown };
      if (entryModule.default === undefined) return { ok: false, errors: [`${entry}: needs a default export`] };
      return { ok: true, entry: entryModule.default };
    } catch (error) {
      return { ok: false, errors: [`Error while loading: ${error instanceof Error ? error.message : String(error)}`] };
    }
  }

  return {
    entry,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** The current source of a file: the overlay's version if changed, else the base. */
    readFile: (path: string): string | undefined => snapshot.overlay[path] ?? files.sources[path],
    listFiles: (): string[] => Object.keys({ ...files.sources, ...snapshot.overlay }).sort(),
    isLocked: (path: string) => locked.has(path),
    /** Builds the overlay and, if it passes, swaps it in. The previous version stays on failure. */
    async apply(overlay: Overlay): Promise<BuildResult> {
      const result = await build(overlay);
      if (!result.ok) return result;
      snapshot = { overlay, entry: result.entry, version: snapshot.version + 1 };
      listeners.forEach((listener) => listener());
      return { ok: true };
    },
  };
}

export type ProgrammableRuntime = ReturnType<typeof createProgrammableRuntime>;
