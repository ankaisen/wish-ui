// The entry of the programmable folder: <wish-root> renders this file's default export.
import { Component } from "@angular/core";
import { TaskList } from "./TaskList";

@Component({
  selector: "app-programmable",
  imports: [TaskList],
  template: `<app-task-list />`,
})
export default class Programmable {}
