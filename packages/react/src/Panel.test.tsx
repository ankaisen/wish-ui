import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createEsbuildCompiler, memoryWishStore, type Wisher } from "@wishkit/core";
import { afterEach, expect, it } from "vitest";
import { createProgrammable } from "./createProgrammable";

// The panel itself is tested in @wishkit/dom. These check that it works with a React root.
afterEach(cleanup);

const source = "export default function App() { return <p>plain</p>; }";

const boldWisher: Wisher = async ({ workspace }) => {
  const files = { "index.tsx": "export default function App() { return <p><b>bold</b></p>; }" };
  const result = await workspace.tryApply({ ...workspace.getSnapshot().overlay, ...files });
  return result.ok ? { status: "applied", summary: "Made the text bold", files } : { status: "failed", error: "no" };
};

function setup() {
  const store = memoryWishStore();
  const wish = createProgrammable({
    files: { sources: { "index.tsx": source }, modules: { "index.tsx": { default: () => <p>plain</p> } } },
    compiler: createEsbuildCompiler(),
    wisher: boldWisher,
    store,
  });
  const view = render(
    <>
      <wish.Root />
      <wish.Panel />
    </>,
  );
  fireEvent.click(screen.getByText("✨ Make a wish"));
  return { store, view };
}

it("applies a wish to the React root and undoes it", async () => {
  const { store } = setup();
  fireEvent.input(screen.getByLabelText("Your wish"), { target: { value: "make it bold" } });
  await act(async () => {
    fireEvent.click(screen.getByText("Make it so"));
  });

  await waitFor(() => expect(screen.getByText("Undo")).toBeTruthy(), { timeout: 4000 });
  expect(screen.getByText("bold").tagName).toBe("B");
  expect(screen.getByText("bold").closest("p")!.getAttribute("data-source-file")).toBe("index.tsx");

  await act(async () => {
    fireEvent.click(screen.getByText("Undo"));
  });
  await waitFor(() => expect(screen.getByLabelText("Turn on: make it bold")).toBeTruthy(), { timeout: 4000 });
  expect(screen.getByText("plain")).toBeTruthy();
  expect(await store.load()).toMatchObject([{ text: "make it bold", enabled: false }]);
});

it("removes the panel when unmounted", () => {
  const { view } = setup();
  view.unmount();
  expect(screen.queryByLabelText("Wish panel")).toBeNull();
});
