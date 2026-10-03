import "@angular/compiler";
import { ApplicationRef, Component, createComponent, type ComponentRef } from "@angular/core";
import { createApplication } from "@angular/platform-browser";
import { afterEach, expect, it } from "vitest";
import { createAngularCompiler } from "./compiler";
import { createProgrammable, WishRoot } from "./createProgrammable";

@Component({ selector: "app-bundled", template: "<p>bundled</p>" })
class Bundled {}

const capabilities = { greeting: () => "hello" };
let cleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  document.body.innerHTML = "";
});

async function setup() {
  const wish = createProgrammable({
    files: {
      sources: { "index.ts": "", "capabilities.ts": "" },
      modules: { "index.ts": { default: Bundled }, "capabilities.ts": capabilities },
    },
    compiler: createAngularCompiler(),
  });
  const app = await createApplication();
  const host = document.createElement("div");
  document.body.append(host);
  const ref: ComponentRef<WishRoot> = createComponent(WishRoot, {
    environmentInjector: app.injector,
    hostElement: host,
  });
  ref.setInput("wish", wish);
  app.attachView(ref.hostView);
  ref.changeDetectorRef.detectChanges();
  cleanup = () => app.destroy();
  return { ...wish, host, app: app.injector.get(ApplicationRef) };
}

it("renders the bundled entry, then swaps in a compiled component live", async () => {
  const { runtime, host } = await setup();
  expect(host.textContent).toBe("bundled");

  const result = await runtime.apply({
    "index.ts": `import { Component, signal } from "@angular/core";
import { greeting } from "./capabilities";
import { Name } from "./Name";

@Component({
  selector: "app-entry",
  imports: [Name],
  template: \`
    <section>
      <h2>{{ greeting() }} {{ count() }}</h2>
      @if (count() > 0) { <app-name name="Ada" /> }
    </section>
  \`,
})
export default class Entry {
  greeting = greeting;
  count = signal(1);
}
`,
    "Name.ts": `import { Component, Input } from "@angular/core";

@Component({ selector: "app-name", template: "<b>{{ name }}</b>" })
export class Name {
  @Input() name = "";
}
`,
  });
  expect(result).toEqual({ ok: true });

  const heading = host.querySelector("h2")!;
  expect(heading.textContent).toBe("hello 1");
  expect(heading.dataset).toMatchObject({ sourceFile: "index.ts", sourceLine: "10" });
  expect(host.querySelector("b")!.textContent).toBe("Ada");
  expect(host.querySelector("b")!.dataset).toMatchObject({ sourceFile: "Name.ts", sourceLine: "3" });
});

it("contains a render error and brings back the previous version", async () => {
  const { runtime, host } = await setup();
  const result = await runtime.tryApply({
    "index.ts": `import { Component } from "@angular/core";

@Component({ selector: "app-entry", template: "<p>{{ broken() }}</p>" })
export default class Entry {
  broken(): string {
    throw new Error("broken");
  }
}
`,
  });
  expect(result).toEqual({ ok: false, errors: ["Error while rendering: broken"] });
  expect(host.textContent).toBe("bundled");
  expect(host.querySelector('[role="alert"]')).toBeNull();
});

it("reports a template the JIT compiler rejects", async () => {
  const { runtime } = await setup();
  const result = await runtime.tryApply({
    "index.ts": `import { Component } from "@angular/core";

@Component({ selector: "app-entry", template: "<p>{{ missing( }}</p>" })
export default class Entry {}
`,
  });
  expect(result.ok).toBe(false);
  expect(!result.ok && result.errors[0]).toMatch(/^Error while rendering: /);
});
