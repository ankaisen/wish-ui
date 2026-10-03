import { fireEvent, screen } from "@testing-library/dom";
import { afterEach, expect, it } from "vitest";
import { createApp, nextTick, type App as VueApp } from "vue";
import App from "./App.vue";
import { wish } from "./wish";

let app: VueApp | undefined;

afterEach(() => {
  app?.unmount();
  document.body.innerHTML = "";
});

function mount() {
  const host = document.createElement("div");
  document.body.append(host);
  app = createApp(App);
  app.mount(host);
}

it("shows the seeded tasks and adds a new one", async () => {
  mount();
  expect(screen.getByText("Buy groceries")).toBeTruthy();
  expect(screen.getByText("3 open · 0 done")).toBeTruthy();

  fireEvent.input(screen.getByLabelText("New task"), { target: { value: "Plan the demo" } });
  fireEvent.click(screen.getByText("Add"));
  await nextTick();

  expect(screen.getByText("Plan the demo")).toBeTruthy();
  expect(screen.getByText("4 open · 0 done")).toBeTruthy();
});

it("swaps in a changed task list while the tasks stay", async () => {
  mount();
  const source = wish.runtime.readFile("TaskList.vue")!;

  const result = await wish.runtime.apply({ "TaskList.vue": source.replace("<h2>Tasks</h2>", "<h2>My tasks</h2>") });
  expect(result).toEqual({ ok: true });
  await nextTick();

  expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("My tasks");
  expect(screen.getByRole("heading", { level: 2 }).dataset.sourceFile).toBe("TaskList.vue");
  expect(screen.getByText("Plan the demo")).toBeTruthy();
});
