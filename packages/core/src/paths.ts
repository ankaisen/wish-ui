// Paths are relative to the programmable root, e.g. "TaskList.tsx" or "lists/Item.tsx".

const EXTENSIONS = ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts"];

export function isRelative(specifier: string): boolean {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

/** Joins a relative specifier onto the importing file's folder; returns null if it leaves the root. */
export function joinPath(from: string, specifier: string): string | null {
  const parts = from.split("/").slice(0, -1);
  for (const segment of specifier.split("/")) {
    if (segment === "." || segment === "") continue;
    if (segment === "..") {
      if (parts.length === 0) return null;
      parts.pop();
    } else {
      parts.push(segment);
    }
  }
  return parts.join("/");
}

/** Resolves a relative import to a file in `files`, trying the usual extensions. */
export function resolveFile(from: string, specifier: string, files: ReadonlySet<string>): string | null {
  const base = joinPath(from, specifier);
  if (base === null) return null;
  for (const extension of EXTENSIONS) {
    if (files.has(base + extension)) return base + extension;
  }
  return null;
}
