import { Component, computed } from "@angular/core";
import { WishPanel, WishRoot } from "@wishkit/angular";
import { taskListSignal } from "./store";
import { wish } from "./wish";

@Component({
  selector: "app-root",
  imports: [WishRoot, WishPanel],
  template: `
    <div class="app">
      <header class="top-bar">
        <h1>Tasks</h1>
      </header>
      <aside class="sidebar">
        <p>{{ open() }} open · {{ all().length - open() }} done</p>
      </aside>
      <main class="content">
        <wish-root [wish]="wish" />
        <wish-panel [wish]="wish" />
      </main>
    </div>
  `,
})
export class App {
  wish = wish;
  all = taskListSignal();
  open = computed(() => this.all().filter((task) => !task.done).length);
}
