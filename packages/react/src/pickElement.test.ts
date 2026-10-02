import { afterEach, expect, it } from "vitest";
import { pickElement, selectionFor } from "./pickElement";

afterEach(() => {
  document.body.innerHTML = "";
});

function mount() {
  document.body.innerHTML = `
    <header><h1 data-source-file="App.tsx" data-source-line="3">Outside</h1></header>
    <div data-wish-root>
      <ul data-source-file="TaskList.tsx" data-source-line="12">
        <li data-source-file="TaskList.tsx" data-source-line="14"><span>Buy   groceries</span></li>
      </ul>
    </div>`;
}

it("maps a click inside a root to the nearest tagged element", () => {
  mount();
  const span = document.querySelector("span")!;
  expect(selectionFor(span)?.selection).toEqual({ file: "TaskList.tsx", line: 14, tag: "li", text: "Buy groceries" });
});

it("ignores elements outside a programmable root", () => {
  mount();
  expect(selectionFor(document.querySelector("h1"))).toBeNull();
});

it("resolves with the clicked element and swallows the click", async () => {
  mount();
  let appSawClick = false;
  document.querySelector("li")!.addEventListener("click", () => (appSawClick = true));

  const picked = pickElement();
  document.querySelector("span")!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

  expect(await picked).toMatchObject({ file: "TaskList.tsx", line: 14 });
  expect(appSawClick).toBe(false);
  expect(document.body.style.cursor).toBe("");
});

it("cancels on Escape", async () => {
  mount();
  const picked = pickElement();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  expect(await picked).toBeNull();
});
