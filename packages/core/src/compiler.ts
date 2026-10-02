import * as esbuild from "esbuild-wasm";

export type Compiler = {
  /** Compiles one TypeScript/TSX file to a CommonJS module body. */
  compile(path: string, source: string): Promise<string>;
};

export class CompileError extends Error {
  constructor(
    readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = "CompileError";
  }
}

let initialized: Promise<void> | undefined;

// esbuild-wasm runs its Node build under Node (tests, jsdom), where a wasmURL is rejected.
const inNode = Boolean((globalThis as { process?: { versions?: { node?: string } } }).process?.versions?.node);

/**
 * esbuild-wasm compiles in the browser (and in Node for tests). In the browser pass the
 * URL of `esbuild-wasm/esbuild.wasm`; in Node leave it out.
 */
export function createEsbuildCompiler(options: { wasmURL?: string | URL } = {}): Compiler {
  return {
    async compile(path, source) {
      initialized ??= esbuild.initialize(
        options.wasmURL && !inNode ? { wasmURL: options.wasmURL, worker: typeof Worker !== "undefined" } : {},
      );
      await initialized;
      try {
        const result = await esbuild.transform(source, {
          loader: path.endsWith("x") ? "tsx" : "ts",
          format: "cjs",
          jsx: "automatic",
          // jsxDev passes each element's file and line, which the runtime turns into data-source-* attributes.
          jsxDev: true,
          sourcefile: path,
          target: "es2022",
        });
        return result.code;
      } catch (error) {
        const failure = error as { errors?: { text: string; location?: { line: number } | null }[] };
        const first = failure.errors?.[0];
        if (first) {
          throw new CompileError(path, first.location ? `line ${first.location.line}: ${first.text}` : first.text);
        }
        throw error;
      }
    },
  };
}
