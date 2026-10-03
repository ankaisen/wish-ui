/** The UI framework programmable files are written for, as the runtime and the wisher see it. */
export type Framework = {
  /** Shown to the model, e.g. "React". */
  name: string;
  /** File types a wish may create or rewrite, e.g. [".tsx", ".ts"]. */
  extensions: string[];
  /** Rules for writing files in this framework, shown to the model: file layout, the entry's export, styling. */
  guidance: string;
};

/** True when `path` ends in one of the framework's file types. */
export function hasExtension(framework: Framework, path: string): boolean {
  return framework.extensions.some((extension) => path.endsWith(extension));
}
