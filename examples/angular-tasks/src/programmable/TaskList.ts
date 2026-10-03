import { Component, signal } from "@angular/core";
import { tasks } from "./capabilities";

@Component({
  selector: "app-task-list",
  template: `
    <section class="task-list">
      <h2>Tasks</h2>
      <ul>
        @for (task of tasks.all(); track task.id) {
          <li [class.done]="task.done">
            <label>
              <input type="checkbox" [checked]="task.done" (change)="tasks.toggle(task.id)" />
              <span>{{ task.title }}</span>
            </label>
            <button type="button" [attr.aria-label]="'Delete ' + task.title" (click)="tasks.remove(task.id)">×</button>
          </li>
        }
      </ul>
      <form (submit)="add($event)">
        <input
          aria-label="New task"
          placeholder="Add a task"
          [value]="title()"
          (input)="title.set($any($event.target).value)"
        />
        <button type="submit">Add</button>
      </form>
    </section>
  `,
})
export class TaskList {
  tasks = tasks;
  title = signal("");

  add(event: Event) {
    event.preventDefault();
    tasks.add(this.title());
    this.title.set("");
  }
}
