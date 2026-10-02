import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Task } from "./api";

/** Reads a text file, or returns null if it doesn't exist yet. */
export async function readText(file: string): Promise<string | null> {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/** Writes through a temporary file, so a crash mid-write never leaves half a file behind. */
export async function writeText(file: string, text: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, text, "utf8");
  await rename(temporary, file);
}

/** Moves unreadable text aside, next to the file it came from, so nothing is lost. */
export async function keepUnreadable(file: string, text: string): Promise<void> {
  await writeText(`${file}.unreadable-${Date.now()}`, text);
}

const SEED: Task[] = [
  { id: "1", title: "Buy groceries", done: false },
  { id: "2", title: "Finish report", done: false },
  { id: "3", title: "Read paper", done: false },
];

function isTask(value: unknown): value is Task {
  if (typeof value !== "object" || value === null) return false;
  const task = value as Record<string, unknown>;
  return typeof task.id === "string" && typeof task.title === "string" && typeof task.done === "boolean";
}

export function parseTasks(text: string): Task[] | null {
  try {
    const value: unknown = JSON.parse(text);
    return Array.isArray(value) && value.every(isTask) ? value : null;
  } catch {
    return null;
  }
}

/** The task list, kept in a JSON file. Changes run one at a time. */
export function createTaskFile(file: string, newId: () => string) {
  let queue: Promise<unknown> = Promise.resolve();

  async function load(): Promise<Task[]> {
    const text = await readText(file);
    if (text === null) return SEED;
    const tasks = parseTasks(text);
    if (tasks) return tasks;
    await keepUnreadable(file, text);
    return SEED;
  }

  function update(change: (tasks: Task[]) => Task[]): Promise<Task[]> {
    const run = queue.then(async () => {
      const tasks = change(await load());
      await writeText(file, JSON.stringify(tasks, null, 2));
      return tasks;
    });
    queue = run.catch(() => undefined);
    return run;
  }

  return {
    list: load,
    add: (title: string) => update((tasks) => [...tasks, { id: newId(), title, done: false }]),
    toggle: (id: string) => update((tasks) => tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task))),
    remove: (id: string) => update((tasks) => tasks.filter((task) => task.id !== id)),
  };
}
