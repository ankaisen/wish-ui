import { act, cleanup, render, screen } from "@testing-library/react";
import { createEsbuildCompiler } from "@wish-ui/core";
import { afterEach, expect, it } from "vitest";
import { createProgrammable } from "./createProgrammable";

afterEach(cleanup);

function Bundled() {
  return <p>bundled</p>;
}

it("renders the bundled entry, then swaps in an overlay live", async () => {
  const { runtime, Root } = createProgrammable({
    files: {
      sources: { "index.tsx": "export default function App() { return <p>bundled</p>; }" },
      modules: { "index.tsx": { default: Bundled } },
    },
    compiler: createEsbuildCompiler(),
  });

  render(<Root />);
  expect(screen.getByText("bundled")).toBeTruthy();

  await act(async () => {
    const result = await runtime.apply({
      "index.tsx": "export default function App({ name }: { name?: string }) { return <h2>wished {name}</h2>; }",
    });
    expect(result).toEqual({ ok: true });
  });

  const heading = screen.getByRole("heading");
  expect(heading.textContent).toBe("wished ");
  expect(heading.getAttribute("data-source-file")).toBe("index.tsx");
});

it("contains a render error to the programmable part", async () => {
  const { runtime, Root } = createProgrammable({
    files: { sources: {}, modules: { "index.tsx": { default: Bundled } } },
    compiler: createEsbuildCompiler(),
  });
  render(<Root />);

  const originalError = console.error;
  console.error = () => {};
  try {
    await act(async () => {
      await runtime.apply({ "index.tsx": 'export default function App() { throw new Error("broken"); }' });
    });
  } finally {
    console.error = originalError;
  }
  expect(screen.getByRole("alert").textContent).toContain("broken");
});
