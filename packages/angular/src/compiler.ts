import { createEsbuildCompiler, type Compiler, type EsbuildCompilerOptions } from "@wishkit/core";
import { tagTemplates } from "./templates";

// Loading @angular/compiler also turns on JIT compilation, which the compiled components need
// when they are first used. An app built ahead of time doesn't ship it, so it loads on first use.
let angular: Promise<typeof import("@angular/compiler")> | undefined;

/**
 * Compiles programmable Angular files in the browser: tags inline templates with their source
 * lines, then esbuild compiles the TypeScript with legacy decorators. Angular's JIT compiler
 * turns the decorated classes into components when they are first rendered.
 */
export function createAngularCompiler(options: Pick<EsbuildCompilerOptions, "wasmURL"> = {}): Compiler {
  const ts = createEsbuildCompiler({
    ...options,
    tsconfig: { experimentalDecorators: true, useDefineForClassFields: false },
  });
  return {
    async compile(path, source) {
      angular ??= import("@angular/compiler");
      return ts.compile(path, tagTemplates(await angular, path, source));
    },
  };
}
