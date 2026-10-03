import type * as AngularCompiler from "@angular/compiler";

type Compiler = typeof AngularCompiler;

type Found = { start: number; end: number; quote: string };

/** Inline `template:` strings in a TypeScript file: where each starts (just past the backtick or quote) and ends. */
export function findTemplates(source: string): Found[] {
  const found: Found[] = [];
  const pattern = /\btemplate\s*:\s*([`'"])/g;
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    const quote = match[1]!;
    const start = match.index + match[0].length;
    let index = start;
    while (index < source.length && source[index] !== quote) {
      if (source[index] === "\\") index++;
      // A template with ${...} in it is built at runtime, so its offsets can't be trusted.
      else if (quote === "`" && source.startsWith("${", index)) break;
      index++;
    }
    if (source[index] === quote) found.push({ start, end: index, quote });
    pattern.lastIndex = index + 1;
  }
  return found;
}

function lineAt(source: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < offset; index++) if (source.charCodeAt(index) === 10) line++;
  return line;
}

/**
 * Adds data-source-file/line to every DOM element in a file's inline Angular templates, which
 * is what the user selects. Templates that don't parse are left alone: the JIT compiler
 * reports their errors when the component is used.
 */
export function tagTemplates(compiler: Compiler, path: string, source: string): string {
  const insertions: { at: number; text: string }[] = [];

  for (const { start, end, quote } of findTemplates(source)) {
    // Attribute quotes that don't end the string they're written into.
    const q = quote === '"' ? "'" : '"';
    const template = source.slice(start, end);
    const parsed = compiler.parseTemplate(template, path, { preserveWhitespaces: true });
    if (parsed.errors?.length) continue;
    const firstLine = lineAt(source, start);

    class Tagger extends compiler.TmplAstRecursiveVisitor {
      override visitElement(element: AngularCompiler.TmplAstElement) {
        const offset = element.startSourceSpan.start.offset;
        const tag = /^<([^\s/>]+)/.exec(template.slice(offset))?.[1];
        if (tag && !tag.startsWith("ng-")) {
          const line = firstLine + element.startSourceSpan.start.line;
          insertions.push({
            at: start + offset + 1 + tag.length,
            text: ` data-source-file=${q}${path}${q} data-source-line=${q}${line}${q}`,
          });
        }
        super.visitElement(element);
      }
    }
    compiler.tmplAstVisitAll(new Tagger(), parsed.nodes);
  }

  let result = source;
  for (const { at, text } of insertions.sort((a, b) => b.at - a.at)) {
    result = result.slice(0, at) + text + result.slice(at);
  }
  return result;
}
