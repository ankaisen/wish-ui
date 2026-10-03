import { CompileError, hashSource, type Compiler } from "@wishkit/core";
import type { CompilerOptions } from "vue/compiler-sfc";

/** What compiled single-file components import to add their <style> blocks to the page. */
export const STYLES_MODULE = "@wishkit/vue/styles";

type SfcCompiler = typeof import("vue/compiler-sfc");

// Vue's compiler is large, so it loads the first time a .vue file is compiled.
let sfc: Promise<SfcCompiler> | undefined;

// compiler-core node types: an element node with tagType ELEMENT is a plain DOM element, not a component.
const ELEMENT_NODE = 1;
const PLAIN_ELEMENT = 0;
const ATTRIBUTE_NODE = 6;
const TEXT_NODE = 2;

type TemplateNode = {
  type: number;
  tagType?: number;
  loc: { start: { line: number } };
  props?: unknown[];
};

/** Adds data-source-file/line to every DOM element in a template, which is what the user selects. */
function sourceAttributes(path: string): NonNullable<CompilerOptions["nodeTransforms"]>[number] {
  return (node) => {
    const element = node as unknown as TemplateNode;
    if (element.type !== ELEMENT_NODE || element.tagType !== PLAIN_ELEMENT) return;
    const attribute = (name: string, content: string) => ({
      type: ATTRIBUTE_NODE,
      name,
      value: { type: TEXT_NODE, content, loc: element.loc },
      loc: element.loc,
      nameLoc: element.loc,
    });
    element.props!.push(
      attribute("data-source-file", path),
      attribute("data-source-line", String(element.loc.start.line)),
    );
  };
}

function lineOf(error: unknown): string {
  const location = (error as { loc?: { start: { line: number } } }).loc;
  const message = error instanceof Error ? error.message : String(error);
  return location ? `line ${location.start.line}: ${message}` : message;
}

/** Compiles one single-file component to TypeScript whose default export is the component. */
export function compileSfc(compiler: SfcCompiler, path: string, source: string): string {
  const { descriptor, errors } = compiler.parse(source, { filename: path });
  if (errors.length) throw new CompileError(path, lineOf(errors[0]));
  for (const style of descriptor.styles) {
    if (style.lang && style.lang !== "css") throw new CompileError(path, `<style lang="${style.lang}"> isn't supported; use plain CSS`);
  }

  // A hash of the source, not just the path, so scoped CSS from an earlier version never matches this one.
  const id = hashSource(`${path}\n${source}`);
  const scopeId = `data-v-${id}`;
  const scoped = descriptor.styles.some((style) => style.scoped);
  const compilerOptions: CompilerOptions = { nodeTransforms: [sourceAttributes(path)] };
  const parts: string[] = [];

  let bindings: CompilerOptions["bindingMetadata"];
  if (descriptor.script || descriptor.scriptSetup) {
    const script = compiler.compileScript(descriptor, {
      id,
      genDefaultAs: "__sfc__",
      inlineTemplate: true,
      templateOptions: { scoped, compilerOptions },
    });
    parts.push(script.content);
    bindings = script.bindings;
  } else {
    parts.push("const __sfc__ = {};");
  }

  // <script setup> inlines its template above. Otherwise the template becomes a render function.
  if (descriptor.template && !descriptor.scriptSetup) {
    const template = compiler.compileTemplate({
      source: descriptor.template.content,
      ast: descriptor.template.ast,
      filename: path,
      id,
      scoped,
      compilerOptions: { ...compilerOptions, bindingMetadata: bindings },
    });
    if (template.errors.length) throw new CompileError(path, lineOf(template.errors[0]));
    parts.push(template.code.replace(/\bexport function render\b/, "function render"), "__sfc__.render = render;");
  }

  if (scoped) parts.push(`__sfc__.__scopeId = ${JSON.stringify(scopeId)};`);

  const css = { scoped: [] as string[], global: [] as string[] };
  for (const style of descriptor.styles) {
    const result = compiler.compileStyle({ source: style.content, filename: path, id: scopeId, scoped: style.scoped });
    if (result.errors.length) throw new CompileError(path, lineOf(result.errors[0]));
    (style.scoped ? css.scoped : css.global).push(result.code);
  }
  if (css.scoped.length || css.global.length) {
    parts.push(
      `import { addStyles as __addStyles } from ${JSON.stringify(STYLES_MODULE)};`,
      `__addStyles(${JSON.stringify(path)}, ${JSON.stringify(scopeId)}, ${JSON.stringify(css.scoped.join("\n"))}, ${JSON.stringify(css.global.join("\n"))});`,
    );
  }

  parts.push("export default __sfc__;");
  return parts.join("\n");
}

/**
 * Compiles .vue single-file components with Vue's own compiler, then hands the TypeScript it
 * produces, and every .ts file, to `ts` (usually esbuild).
 */
export function createVueCompiler(ts: Compiler): Compiler {
  return {
    async compile(path, source) {
      if (!path.endsWith(".vue")) return ts.compile(path, source);
      sfc ??= import("vue/compiler-sfc");
      let code: string;
      try {
        code = compileSfc(await sfc, path, source);
      } catch (error) {
        if (error instanceof CompileError) throw error;
        throw new CompileError(path, lineOf(error));
      }
      return ts.compile(path, code);
    },
  };
}
