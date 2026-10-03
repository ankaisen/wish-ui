import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createEsbuildCompiler, hashSource, memoryWishStore, type SavedWish, type Wisher, type WishStore } from "@wishkit/core";
import { afterEach, expect, it, vi } from "vitest";
import type { ApiKeyStore } from "./apiKey";
import { createProgrammable } from "./createProgrammable";

afterEach(cleanup);

const source = "export default function App() { return <p>plain</p>; }";

function setup(wisher: Wisher, apiKey?: ApiKeyStore, store: WishStore = memoryWishStore()) {
  const wish = createProgrammable({
    files: { sources: { "index.tsx": source }, modules: { "index.tsx": { default: () => <p>plain</p> } } },
    compiler: createEsbuildCompiler(),
    wisher,
    apiKey,
    store,
  });
  render(
    <>
      <wish.Root />
      <wish.Panel />
    </>,
  );
  fireEvent.click(screen.getByText("✨ Make a wish"));
  return wish;
}

const boldWisher: Wisher = async ({ workspace, onProgress }) => {
  onProgress?.("Writing index.tsx");
  const files = { "index.tsx": "export default function App() { return <p><b>bold</b></p>; }" };
  const result = await workspace.tryApply({ ...workspace.getSnapshot().overlay, ...files });
  return result.ok ? { status: "applied", summary: "Made the text bold", files } : { status: "failed", error: "no" };
};

async function wishFor(text: string) {
  fireEvent.change(screen.getByLabelText("Your wish"), { target: { value: text } });
  await act(async () => {
    fireEvent.click(screen.getByText("Make it so"));
  });
}

it("applies a wish, saves it, and undoes it", async () => {
  const store = memoryWishStore();
  setup(boldWisher, undefined, store);
  await wishFor("make it bold");

  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("✓ Made the text bold Undo"), { timeout: 4000 });
  expect(screen.getByText("bold").tagName).toBe("B");
  expect(await store.load()).toMatchObject([{ text: "make it bold", summary: "Made the text bold", enabled: true }]);
  expect(screen.getByLabelText("Turn off: make it bold")).toBeTruthy();

  await act(async () => {
    fireEvent.click(screen.getByText("Undo"));
  });
  await waitFor(() => expect(screen.getByText("plain")).toBeTruthy(), { timeout: 4000 });
  expect(await store.load()).toMatchObject([{ text: "make it bold", enabled: false }]);
  expect(screen.getByLabelText("Turn on: make it bold")).toBeTruthy();
});

function saved(files: Record<string, string>, base: Record<string, string>): SavedWish {
  return { id: "w1", text: "make it bold", summary: "Made the text bold", selection: null, createdAt: 0, files, base, dependsOn: [], enabled: true };
}

it("brings back saved wishes when the app loads", async () => {
  const files = { "index.tsx": "export default function App() { return <p><b>bold</b></p>; }" };
  setup(boldWisher, undefined, memoryWishStore([saved(files, { "index.tsx": hashSource(source) })]));
  await waitFor(() => expect(screen.getByText("bold").tagName).toBe("B"), { timeout: 4000 });
});

it("pauses a wish made against an older app and makes it again", async () => {
  const files = { "index.tsx": "export default function App() { return <p><i>old</i></p>; }" };
  const store = memoryWishStore([saved(files, { "index.tsx": hashSource("an older index.tsx") })]);
  setup(boldWisher, undefined, store);

  await waitFor(() => expect(screen.getByText("The app changed since this wish, so it is paused.")).toBeTruthy());
  expect(screen.getByText("plain")).toBeTruthy();

  await act(async () => {
    fireEvent.click(screen.getByText("Make it again"));
  });
  await waitFor(() => expect(screen.getByText("bold").tagName).toBe("B"), { timeout: 4000 });
  const wishes = await store.load();
  expect(wishes).toMatchObject([{ text: "make it bold", enabled: true, base: { "index.tsx": hashSource(source) } }]);
  expect(wishes[0]!.id).not.toBe("w1");
  expect(screen.queryByText("Make it again")).toBeNull();
});

it("removes a wish after asking", async () => {
  const files = { "index.tsx": "export default function App() { return <p><b>bold</b></p>; }" };
  const store = memoryWishStore([saved(files, { "index.tsx": hashSource(source) })]);
  setup(boldWisher, undefined, store);
  await waitFor(() => expect(screen.getByText("bold")).toBeTruthy(), { timeout: 4000 });

  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  await act(async () => {
    fireEvent.click(screen.getByLabelText("Remove: make it bold"));
  });
  expect(confirm).toHaveBeenCalledWith("Remove “make it bold”? This can't be undone.");
  await waitFor(() => expect(screen.getByText("plain")).toBeTruthy(), { timeout: 4000 });
  expect(await store.load()).toEqual([]);
  confirm.mockRestore();
});

it("explains a declined wish", async () => {
  setup(async () => ({ status: "declined", reason: "There is no capability for due dates." }));
  await wishFor("add due dates");
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toBe("Can't do that here: There is no capability for due dates."),
  );
});

it("asks for an API key before the first wish", () => {
  let stored: string | null = null;
  setup(boldWisher, { get: () => stored, set: (key) => (stored = key) });

  expect(screen.queryByLabelText("Your wish")).toBeNull();
  fireEvent.change(screen.getByLabelText("API key"), { target: { value: " sk-ant-test " } });
  fireEvent.click(screen.getByText("Save key"));

  expect(stored).toBe("sk-ant-test");
  expect(screen.getByLabelText("Your wish")).toBeTruthy();
});

it("waits for saved wishes to come back before making a new one", async () => {
  const bold = { "index.tsx": "export default function App() { return <p><b>bold</b></p>; }" };
  let seen: string | undefined;
  const reader: Wisher = async ({ workspace }) => {
    seen = workspace.readFile("index.tsx");
    return { status: "declined", reason: "just looking" };
  };
  setup(reader, undefined, memoryWishStore([saved(bold, { "index.tsx": hashSource(source) })]));
  // Wish straight away, before the saved wish has been compiled and applied.
  await wishFor("look at the app");
  await waitFor(() => expect(seen).toBeDefined(), { timeout: 4000 });
  expect(seen).toContain("<b>bold</b>");
});
