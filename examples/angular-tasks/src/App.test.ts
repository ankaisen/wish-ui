import "@angular/compiler";
import { ApplicationRef, createComponent } from "@angular/core";
import { createApplication } from "@angular/platform-browser";
import { fireEvent, screen } from "@testing-library/dom";
import { afterEach, expect, it } from "vitest";
import { App } from "./App";
import { wish } from "./wish";

let destroy: (() => void) | undefined;

afterEach(() => {
  destroy?.();
  document.body.innerHTML = "";
});

async function mount() {
  const app = await createApplication();
  const host = document.createElement("div");
  document.body.append(host);
  const ref = createComponent(App, { environmentInjector: app.injector, hostElement: host });
  app.attachView(ref.hostView);
  ref.changeDetectorRef.detectChanges();
  destroy = () => app.destroy();
  return app.injector.get(ApplicationRef);
}

it("shows the seeded tasks and adds a new one", async () => {
  const app = await mount();
  expect(screen.getByText("Buy groceries")).toBeTruthy();
  expect(screen.getByText("3 open · 0 done")).toBeTruthy();

  fireEvent.input(screen.getByLabelText("New task"), { target: { value: "Plan the demo" } });
  fireEvent.click(screen.getByText("Add"));
  await app.whenStable();

  expect(screen.getByText("Plan the demo")).toBeTruthy();
  expect(screen.getByText("4 open · 0 done")).toBeTruthy();
});

it("swaps in a changed task list while the tasks stay", async () => {
  await mount();
  const source = wish.runtime.readFile("TaskList.ts")!;

  const result = await wish.runtime.apply({ "TaskList.ts": source.replace("<h2>Tasks</h2>", "<h2>My tasks</h2>") });
  expect(result).toEqual({ ok: true });

  expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("My tasks");
  expect(screen.getByRole("heading", { level: 2 }).dataset.sourceFile).toBe("TaskList.ts");
  expect(screen.getByText("Plan the demo")).toBeTruthy();
});
