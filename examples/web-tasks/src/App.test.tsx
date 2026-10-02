import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { App } from "./App";

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
