import { describe, expect, it } from "vitest";
import { createTaskStore, parseTasks, type Task, type TaskStorage } from "./store";

function memoryStorage(initial: Task[] | null = []) {
  let stored = initial;
  const listeners = new Set<() => void>();
  const storage: TaskStorage = {
    load: () => stored,
    save: (tasks) => {
      stored = tasks;
    },
    subscribe(onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
  };
  return {
    storage,
    // Simulates another tab writing to the same storage.
    writeFromOtherTab(tasks: Task[]) {
      stored = tasks;
      listeners.forEach((listener) => listener());
    },
    read: () => stored,
  };
}

describe("task store", () => {
  it("adds, toggles and removes tasks and notifies subscribers", () => {
    const { storage, read } = memoryStorage();
    const store = createTaskStore(storage);
    let calls = 0;
    store.subscribe(() => calls++);

    store.add("  Write tests  ");
    const [task] = store.getAll();
    expect(task?.title).toBe("Write tests");

    store.toggle(task!.id);
    expect(store.getAll()[0]?.done).toBe(true);

    store.remove(task!.id);
    expect(store.getAll()).toEqual([]);
    expect(read()).toEqual([]);
    expect(calls).toBe(3);
  });

  it("ignores blank titles", () => {
    const store = createTaskStore(memoryStorage().storage);
    store.add("   ");
    expect(store.getAll()).toEqual([]);
  });

  it("starts from the seed when nothing valid is stored", () => {
    const seed = [{ id: "s", title: "Seed", done: false }];
    expect(createTaskStore(memoryStorage(null).storage, seed).getAll()).toEqual(seed);
  });

  it("keeps changes made in another tab", () => {
    const tabs = memoryStorage();
    const store = createTaskStore(tabs.storage);
    let calls = 0;
    store.subscribe(() => calls++);

    tabs.writeFromOtherTab([{ id: "a", title: "From tab A", done: false }]);
    expect(store.getAll().map((task) => task.title)).toEqual(["From tab A"]);
    expect(calls).toBe(1);

    store.add("From tab B");
    expect(tabs.read()?.map((task) => task.title)).toEqual(["From tab A", "From tab B"]);
  });
});

describe("parseTasks", () => {
  it("rejects stored values that are not a task list", () => {
    expect(parseTasks(null)).toBeNull();
    expect(parseTasks("null")).toBeNull();
    expect(parseTasks("{}")).toBeNull();
    expect(parseTasks("not json")).toBeNull();
    expect(parseTasks('[{"id":"1","title":"x"}]')).toBeNull();
  });

  it("accepts a valid task list", () => {
    expect(parseTasks('[{"id":"1","title":"x","done":true}]')).toEqual([{ id: "1", title: "x", done: true }]);
  });
});
