// Add `"types": ["@wish-ui/vite-plugin/client"]` to your tsconfig to type the virtual module.
declare module "virtual:wish-ui/programmable" {
  const files: {
    /** The programmable root, relative to the project root. */
    root: string;
    /** File path relative to the root -> source text. */
    sources: Record<string, string>;
    /** File path relative to the root -> the bundled module. */
    modules: Record<string, unknown>;
  };
  export default files;
}
