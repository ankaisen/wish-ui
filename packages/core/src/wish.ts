import type { BuildResult, Overlay } from "./runtime";

/** What the user pointed at: the element and the source line that created it. */
export type Selection = {
  file: string;
  line: number;
  /** The element's tag, e.g. "h2". */
  tag: string;
  /** The element's visible text, shortened. */
  text: string;
};

/** The programmable folder as a wisher sees it. A ProgrammableRuntime satisfies this. */
export type Workspace = {
  listFiles(): string[];
  readFile(path: string): string | undefined;
  isLocked(path: string): boolean;
  listPackages(): string[];
  getSnapshot(): { overlay: Overlay };
  /** Applies the overlay if it compiles, passes the import check and renders. */
  tryApply(overlay: Overlay): Promise<BuildResult>;
};

export type WishRequest = {
  /** The user's words. */
  text: string;
  selection?: Selection | null;
  workspace: Workspace;
  /** Short progress notes for the UI, e.g. "Reading TaskList.tsx". */
  onProgress?: (note: string) => void;
  signal?: AbortSignal;
};

export type WishOutcome =
  /** The change is live. `files` holds the new content of every file this wish changed. */
  | { status: "applied"; summary: string; files: Record<string, string> }
  /** The wish can't be done inside the boundary; `reason` explains why, for the user. */
  | { status: "declined"; reason: string }
  | { status: "failed"; error: string };

/** Turns a wish into a change. @wish-ui/llm provides one backed by Claude. */
export type Wisher = (request: WishRequest) => Promise<WishOutcome>;
