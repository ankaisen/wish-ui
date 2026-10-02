import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createEsbuildCompiler, type Wisher } from "@wishkit/core";
import { afterEach, expect, it } from "vitest";
import type { ApiKeyStore } from "./apiKey";
import { createProgrammable } from "./createProgrammable";

afterEach(cleanup);

const source = "export default function App() { return <p>plain</p>; }";

function setup(wisher: Wisher, apiKey?: ApiKeyStore) {
  const wish = createProgrammable({
    files: { sources: { "index.tsx": source }, modules: { "index.tsx": { default: () => <p>plain</p> } } },
    compiler: createEsbuildCompiler(),
    wisher,
    apiKey,
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

it("applies a wish, shows its summary, and undoes it", async () => {
  setup(boldWisher);
  await wishFor("make it bold");

  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("✓ Made the text bold"), { timeout: 4000 });
  expect(screen.getByText("bold").tagName).toBe("B");

  await act(async () => {
    fireEvent.click(screen.getByText("Undo last change"));
  });
  await waitFor(() => expect(screen.getByText("plain")).toBeTruthy());
  expect(screen.queryByText("Undo last change")).toBeNull();
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
