import { CompileError, type Compiler } from "./compiler";
import { hasExtension, type Framework } from "./framework";
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
  /** The UI framework the files are written for. */
  framework: Framework;
  /** Packages programmable code may import, by specifier, e.g. { react: React }. Listed to the wisher. */
  packages: Record<string, unknown>;
  /**
   * Modules compiled code may import that wishes aren't offered, by specifier: what the
   * compiler's output refers to, such as a JSX runtime that adds data-source-* attributes.
   */
  internal?: Record<string, unknown>;
  /** Turns one source file into a CommonJS module body. */
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

const IMPORT_PATTERN = /\brequire\(\s*["']([^"']+)["']\s*\)/g;

export function findImports(compiled: string): string[] {
  return [...compiled.matchAll(IMPORT_PATTERN)].map((match) => match[1]!);
}

export function createProgrammableRuntime(options: RuntimeOptions) {
  const { files, entry, framework, compiler } = options;
  const locked = new Set(options.locked);
  const packages: Record<string, unknown> = { ...options.internal, ...options.packages };

  const bundledEntry = (files.modules[entry] as { default?: unknown } | undefined)?.default;
  if (bundledEntry === undefined) throw new Error(`${entry} has no default export`);

  let snapshot: Snapshot = { overlay: {}, entry: bundledEntry, version: 0 };
  const listeners = new Set<() => void>();

  /** Compiles base sources with the overlay on top, checks every import, and evaluates the entry. */
  async function build(overlay: Overlay): Promise<{ ok: true; entry: unknown } | { ok: false; errors: string[] }> {
    const errors: string[] = [];
    for (const path of Object.keys(overlay)) {
      if (locked.has(path)) errors.push(`${path}: this file is locked and cannot be changed`);
      else if (!hasExtension(framework, path)) {
        errors.push(`${path}: only ${framework.extensions.join(", ")} files can be added to the programmable folder`);
      }
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

  /** Builds the overlay and, if it passes, swaps it in. The previous version stays on failure. */
  async function apply(overlay: Overlay): Promise<BuildResult> {
    const result = await build(overlay);
    if (!result.ok) return result;
    snapshot = { overlay, entry: result.entry, version: snapshot.version + 1 };
    listeners.forEach((listener) => listener());
    return { ok: true };
  }

  let renderWaiter: { version: number; settle: (error: Error | null) => void } | undefined;

  /** Called by the view once a version has rendered, or failed to. */
  function reportRender(version: number, error: Error | null = null) {
    if (renderWaiter?.version !== version) return;
    renderWaiter.settle(error);
    renderWaiter = undefined;
  }

  /**
   * Like apply(), but also waits for the new version to render. If rendering throws, the
   * previous version comes back and the error is returned. Without a mounted view it
   * gives up waiting after `renderTimeoutMs` and keeps the change.
   */
  async function tryApply(overlay: Overlay, { renderTimeoutMs = 2000 } = {}): Promise<BuildResult> {
    const previous = snapshot;
    const rendered = new Promise<Error | null>((settle) => {
      renderWaiter = { version: previous.version + 1, settle };
    });
    const result = await apply(overlay);
    if (!result.ok) {
      renderWaiter = undefined;
      return result;
    }
    const error = await Promise.race([
      rendered,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), renderTimeoutMs)),
    ]);
    if (!error) return { ok: true };
    snapshot = { ...previous, version: snapshot.version + 1 };
    listeners.forEach((listener) => listener());
    return { ok: false, errors: [`Error while rendering: ${error.message}`] };
  }

  let prepared: Promise<BuildResult> | undefined;

  return {
    entry,
    framework,
    getSnapshot: () => snapshot,
    /**
     * Switches from the bundled modules to ones compiled from source, which carry
     * data-source-file/line on every DOM element. Done once, before the first selection.
     */
    prepare(): Promise<BuildResult> {
      prepared ??= snapshot.version > 0 ? Promise.resolve({ ok: true }) : apply(snapshot.overlay);
      return prepared.then((result) => {
        if (!result.ok) prepared = undefined;
        return result;
      });
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** The current source of a file: the overlay's version if changed, else the base. */
    readFile: (path: string): string | undefined => snapshot.overlay[path] ?? files.sources[path],
    listFiles: (): string[] => Object.keys({ ...files.sources, ...snapshot.overlay }).sort(),
    isLocked: (path: string) => locked.has(path),
    /** Package specifiers programmable code may import. */
    listPackages: (): string[] => Object.keys(options.packages).sort(),
    apply,
    tryApply,
    reportRender,
  };
}

export type ProgrammableRuntime = ReturnType<typeof createProgrammableRuntime>;
