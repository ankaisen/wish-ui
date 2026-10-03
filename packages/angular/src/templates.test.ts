import * as compiler from "@angular/compiler";
import { expect, it } from "vitest";
import { findTemplates, tagTemplates } from "./templates";

const source = `import { Component } from "@angular/core";

@Component({
  selector: "app-list",
  template: \`
    <section>
      @for (task of tasks; track task) {
        <li [class.done]="task.done">{{ task.title }}</li>
      }
      <ng-container><b>x</b></ng-container>
      <app-item />
    </section>
  \`,
})
export class List {}
`;

it("finds inline templates", () => {
  expect(findTemplates(source)).toHaveLength(1);
  expect(findTemplates("template: `<p>${dynamic}</p>`")).toEqual([]);
  expect(findTemplates("template: '<p>it\\'s</p>'")).toHaveLength(1);
});

it("tags each DOM element with the file and line, inside blocks too", () => {
  const tagged = tagTemplates(compiler, "List.ts", source);
  expect(tagged).toContain('<section data-source-file="List.ts" data-source-line="6">');
  expect(tagged).toContain('<li data-source-file="List.ts" data-source-line="8" [class.done]="task.done">');
  expect(tagged).toContain('<ng-container><b data-source-file="List.ts" data-source-line="10">x</b>');
  expect(tagged).toContain('<app-item data-source-file="List.ts" data-source-line="11" />');
});

it("quotes attributes so they don't end the template string", () => {
  expect(tagTemplates(compiler, "B.ts", 'template: "<b>x</b>"')).toBe(
    "template: \"<b data-source-file='B.ts' data-source-line='1'>x</b>\"",
  );
});

it("leaves templates that don't parse alone", () => {
  const broken = "template: `<div></span>`";
  expect(tagTemplates(compiler, "Broken.ts", broken)).toBe(broken);
});
