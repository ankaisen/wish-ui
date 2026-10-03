import * as esbuild from "esbuild-wasm";

export type Compiler = {
  /** Compiles one source file to a CommonJS module body. */
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

export type EsbuildCompilerOptions = {
  /** The URL of `esbuild-wasm/esbuild.wasm`. Needed in the browser; leave it out in Node. */
  wasmURL?: string | URL;
  /** TypeScript options esbuild should follow, e.g. legacy decorators for Angular. */
  tsconfig?: { experimentalDecorators?: boolean; useDefineForClassFields?: boolean };
};

/** esbuild-wasm compiles TypeScript and TSX in the browser (and in Node for tests). */
export function createEsbuildCompiler(options: EsbuildCompilerOptions = {}): Compiler {
  return {
    async compile(path, source) {
      initialized ??= esbuild.initialize(
        options.wasmURL && !inNode ? { wasmURL: options.wasmURL, worker: typeof Worker !== "undefined" } : {},
      );
      await initialized;
      try {
        const result = await esbuild.transform(source, {
          loader: path.endsWith(".tsx") || path.endsWith(".jsx") ? "tsx" : "ts",
          format: "cjs",
          jsx: "automatic",
          // jsxDev passes each element's file and line to the JSX runtime, which can tag DOM elements with them.
          jsxDev: true,
          sourcefile: path,
          target: "es2022",
          ...(options.tsconfig && { tsconfigRaw: { compilerOptions: options.tsconfig } }),
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
