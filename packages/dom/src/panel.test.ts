import { fireEvent, screen, waitFor } from "@testing-library/dom";
import {
  createEsbuildCompiler,
  hashSource,
  memoryWishStore,
  type SavedWish,
  type Wisher,
  type WishStore,
} from "@wishkit/core";
import { afterEach, expect, it, vi } from "vitest";
import type { ApiKeyStore } from "./apiKey";
import { ROOT_ATTRIBUTE } from "./pickElement";
import { createWishkit } from "./programmable";

// A framework-free stand-in: the entry's default export returns the HTML to show.
const source = 'export default () => "<p>plain</p>";';
const bold = { "index.ts": 'export default () => "<p><b>bold</b></p>";' };

let cleanups: (() => void)[] = [];

afterEach(() => {
  cleanups.forEach((cleanup) => cleanup());
  cleanups = [];
  document.body.innerHTML = "";
});

function setup(wisher: Wisher, apiKey?: ApiKeyStore, store: WishStore = memoryWishStore()) {
  const wish = createWishkit(
    {
      files: { sources: { "index.ts": source }, modules: { "index.ts": { default: () => "<p>plain</p>" } } },
      wisher,
      apiKey,
      store,
    },
    {
      framework: { name: "Plain", extensions: [".ts"], guidance: "" },
      entry: "index.ts",
      packages: {},
      compiler: createEsbuildCompiler(),
    },
  );

  const root = document.createElement("div");
  root.setAttribute(ROOT_ATTRIBUTE, "");
  const show = () => {
    const { entry, version } = wish.runtime.getSnapshot();
    root.innerHTML = (entry as () => string)();
    wish.runtime.reportRender(version);
  };
  show();
  cleanups.push(wish.runtime.subscribe(show));
  void wish.wishes.ready();

  const host = document.createElement("div");
  document.body.append(root, host);
  cleanups.push(wish.mountPanel(host));
  fireEvent.click(screen.getByText("✨ Make a wish"));
  return wish;
}

const boldWisher: Wisher = async ({ workspace, onProgress }) => {
  onProgress?.("Writing index.ts");
  const result = await workspace.tryApply({ ...workspace.getSnapshot().overlay, ...bold });
  return result.ok ? { status: "applied", summary: "Made the text bold", files: bold } : { status: "failed", error: "no" };
};

const textOf = (element: Element) => (element.textContent ?? "").replace(/\s+/g, " ").trim();

function wishFor(text: string) {
  fireEvent.input(screen.getByLabelText("Your wish"), { target: { value: text } });
  fireEvent.click(screen.getByText("Make it so"));
}

function saved(files: Record<string, string>, base: Record<string, string>): SavedWish {
  return { id: "w1", text: "make it bold", summary: "Made the text bold", selection: null, createdAt: 0, files, base, dependsOn: [], enabled: true };
}

it("applies a wish, saves it, and undoes it", async () => {
  const store = memoryWishStore();
  setup(boldWisher, undefined, store);
  wishFor("make it bold");

  await waitFor(() => expect(textOf(screen.getByRole("status"))).toBe("✓ Made the text bold Undo"), { timeout: 4000 });
  expect(screen.getByText("bold").tagName).toBe("B");
  expect(await store.load()).toMatchObject([{ text: "make it bold", summary: "Made the text bold", enabled: true }]);
  expect(screen.getByLabelText("Turn off: make it bold")).toBeTruthy();

  fireEvent.click(screen.getByText("Undo"));
  await waitFor(() => expect(screen.getByLabelText("Turn on: make it bold")).toBeTruthy(), { timeout: 4000 });
  expect(screen.getByText("plain")).toBeTruthy();
  expect(await store.load()).toMatchObject([{ text: "make it bold", enabled: false }]);
});

it("shows progress while a wish runs and clears the box after", async () => {
  let finish!: () => void;
  const waiting = new Promise<void>((resolve) => (finish = resolve));
  setup(async (request) => {
    request.onProgress?.("Reading index.ts");
    await waiting;
    return boldWisher(request);
  });
  wishFor("make it bold");

  await waitFor(() => expect(screen.getByText("Reading index.ts…")).toBeTruthy());
  expect((screen.getByLabelText("Your wish") as HTMLTextAreaElement).disabled).toBe(true);
  finish();
  await waitFor(() => expect(screen.getByText("Make it so")).toBeTruthy(), { timeout: 4000 });
  expect((screen.getByLabelText("Your wish") as HTMLTextAreaElement).value).toBe("");
});

it("brings back saved wishes when the app loads", async () => {
  setup(boldWisher, undefined, memoryWishStore([saved(bold, { "index.ts": hashSource(source) })]));
  await waitFor(() => expect(screen.getByText("bold").tagName).toBe("B"), { timeout: 4000 });
});

it("pauses a wish made against an older app and makes it again", async () => {
  const old = { "index.ts": 'export default () => "<p><i>old</i></p>";' };
  const store = memoryWishStore([saved(old, { "index.ts": hashSource("an older index.ts") })]);
  setup(boldWisher, undefined, store);

  await waitFor(() => expect(screen.getByText("The app changed since this wish, so it is paused.")).toBeTruthy());
  expect(screen.getByText("plain")).toBeTruthy();

  fireEvent.click(screen.getByText("Make it again"));
  await waitFor(() => expect(screen.queryByText("Make it again")).toBeNull(), { timeout: 4000 });
  expect(screen.getByText("bold").tagName).toBe("B");
  const wishes = await store.load();
  expect(wishes).toMatchObject([{ text: "make it bold", enabled: true, base: { "index.ts": hashSource(source) } }]);
  expect(wishes[0]!.id).not.toBe("w1");
});

it("removes a wish after asking", async () => {
  const store = memoryWishStore([saved(bold, { "index.ts": hashSource(source) })]);
  setup(boldWisher, undefined, store);
  await waitFor(() => expect(screen.getByLabelText("Remove: make it bold")).toBeTruthy(), { timeout: 4000 });

  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  fireEvent.click(screen.getByLabelText("Remove: make it bold"));
  expect(confirm).toHaveBeenCalledWith("Remove “make it bold”? This can't be undone.");
  await waitFor(() => expect(screen.queryByLabelText("Remove: make it bold")).toBeNull(), { timeout: 4000 });
  expect(screen.getByText("plain")).toBeTruthy();
  expect(await store.load()).toEqual([]);
  confirm.mockRestore();
});

it("explains a declined wish", async () => {
  setup(async () => ({ status: "declined", reason: "There is no capability for due dates." }));
  wishFor("add due dates");
  await waitFor(() =>
    expect(textOf(screen.getByRole("status"))).toBe("Can't do that here: There is no capability for due dates."),
  );
});

it("asks for an API key before the first wish", () => {
  let stored: string | null = null;
  setup(boldWisher, { get: () => stored, set: (key) => (stored = key) });

  expect(screen.queryByLabelText("Your wish")).toBeNull();
  fireEvent.input(screen.getByLabelText("API key"), { target: { value: " sk-ant-test " } });
  fireEvent.click(screen.getByText("Save key"));

  expect(stored).toBe("sk-ant-test");
  expect(screen.getByLabelText("Your wish")).toBeTruthy();
});

it("lets the user select part of the app", async () => {
  setup(boldWisher);
  fireEvent.click(screen.getByText("Select part of the app"));
  await waitFor(() => expect(screen.getByText("Click something… (Esc to cancel)")).toBeTruthy(), { timeout: 4000 });

  const paragraph = screen.getByText("plain");
  paragraph.setAttribute("data-source-file", "index.ts");
  paragraph.setAttribute("data-source-line", "1");
  fireEvent.click(paragraph);

  await waitFor(() => expect(screen.getByText("Clear")).toBeTruthy());
  expect(textOf(screen.getByText("Clear").parentElement!)).toBe("Selected <p> “plain” Clear");
});

it("waits for saved wishes to come back before making a new one", async () => {
  let seen: string | undefined;
  const reader: Wisher = async ({ workspace }) => {
    seen = workspace.readFile("index.ts");
    return { status: "declined", reason: "just looking" };
  };
  setup(reader, undefined, memoryWishStore([saved(bold, { "index.ts": hashSource(source) })]));
  // Wish straight away, before the saved wish has been compiled and applied.
  wishFor("look at the app");
  await waitFor(() => expect(seen).toBeDefined(), { timeout: 4000 });
  expect(seen).toContain("<b>bold</b>");
});

it("removes itself when unmounted", () => {
  setup(boldWisher);
  cleanups.pop()!();
  expect(screen.queryByText("Make a wish")).toBeNull();
  expect(screen.queryByLabelText("Wish panel")).toBeNull();
});
