import { useState, type FormEvent } from "react";
import { tasks } from "./capabilities";

export function TaskList() {
  const all = tasks.useAll();
  const [title, setTitle] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    tasks.add(title);
    setTitle("");
  }

  return (
    <section className="task-list">
      <h2>Tasks</h2>
      <ul>
        {all.map((task) => (
          <li key={task.id} className={task.done ? "done" : undefined}>
            <label>
              <input type="checkbox" checked={task.done} onChange={() => tasks.toggle(task.id)} />
              <span>{task.title}</span>
            </label>
            <button type="button" aria-label={`Delete ${task.title}`} onClick={() => tasks.remove(task.id)}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={onSubmit}>
        <input
          aria-label="New task"
          placeholder="Add a task"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button type="submit">Add</button>
      </form>
    </section>
  );
}
