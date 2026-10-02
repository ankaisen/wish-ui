import { TaskList } from "./programmable/TaskList";
import { useTaskList } from "./store";

export function App() {
  const all = useTaskList();
  const open = all.filter((task) => !task.done).length;

  return (
    <div className="app">
      <header className="top-bar">
        <h1>Tasks</h1>
      </header>
      <aside className="sidebar">
        <p>
          {open} open · {all.length - open} done
        </p>
      </aside>
      <main className="content">
        <TaskList />
      </main>
    </div>
  );
}
