import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { App } from "./App";
import { wish } from "./wish";

afterEach(cleanup);

it("shows the seeded tasks and adds a new one", () => {
  render(<App />);
  expect(screen.getByText("Buy groceries")).toBeTruthy();
  expect(screen.getByText("3 open · 0 done")).toBeTruthy();

  fireEvent.change(screen.getByLabelText("New task"), { target: { value: "Plan the demo" } });
  fireEvent.click(screen.getByText("Add"));

  expect(screen.getByText("Plan the demo")).toBeTruthy();
  expect(screen.getByText("4 open · 0 done")).toBeTruthy();
});

it("swaps in a changed task list while the tasks stay", async () => {
  render(<App />);
  const source = wish.runtime.readFile("TaskList.tsx")!;

  await act(async () => {
    const result = await wish.runtime.apply({ "TaskList.tsx": source.replace("<h2>Tasks</h2>", "<h2>My tasks</h2>") });
    expect(result).toEqual({ ok: true });
  });

  expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("My tasks");
  expect(screen.getByText("Plan the demo")).toBeTruthy();
});
