import { describe, expect, it } from "vitest";
import { createTaskStore } from "./store";

describe("task store", () => {
  it("adds, toggles and removes tasks and notifies subscribers", () => {
    const saved: unknown[] = [];
    const store = createTaskStore([], (tasks) => saved.push(tasks));
    let calls = 0;
    store.subscribe(() => calls++);

    store.add("  Write tests  ");
    const [task] = store.getAll();
    expect(task?.title).toBe("Write tests");

    store.toggle(task!.id);
    expect(store.getAll()[0]?.done).toBe(true);

    store.remove(task!.id);
    expect(store.getAll()).toEqual([]);
    expect(calls).toBe(3);
    expect(saved).toHaveLength(3);
  });

  it("ignores blank titles", () => {
    const store = createTaskStore([], () => {});
    store.add("   ");
    expect(store.getAll()).toEqual([]);
  });
});
