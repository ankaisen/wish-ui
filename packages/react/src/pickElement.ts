import type { Selection } from "@wishkit/core";

export type { Selection };

const ROOT_SELECTOR = "[data-wish-root]";

export function selectionFor(target: EventTarget | null): { element: HTMLElement; selection: Selection } | null {
  if (!(target instanceof Element)) return null;
  const element = target.closest<HTMLElement>("[data-source-file]");
  if (!element || !element.closest(ROOT_SELECTOR)) return null;
  const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();
  return {
    element,
    selection: {
      file: element.dataset.sourceFile!,
      line: Number(element.dataset.sourceLine),
      tag: element.tagName.toLowerCase(),
      text: text.length > 80 ? `${text.slice(0, 77)}...` : text,
    },
  };
}

/**
 * Lets the user click one element inside a programmable root. Hovered elements get an outline;
 * Escape cancels. Clicks are swallowed so the app doesn't react to them.
 */
export function pickElement(document: Document = window.document): Promise<Selection | null> {
  return new Promise((resolve) => {
    const highlight = document.createElement("div");
    Object.assign(highlight.style, {
      position: "fixed",
      pointerEvents: "none",
      outline: "2px solid #6e56cf",
      background: "rgba(110, 86, 207, 0.08)",
      borderRadius: "4px",
      zIndex: "2147483646",
      display: "none",
    });
    document.body.append(highlight);
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "crosshair";

    function finish(selection: Selection | null) {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
      highlight.remove();
      document.body.style.cursor = previousCursor;
      resolve(selection);
    }

    function onMove(event: MouseEvent) {
      const hit = selectionFor(event.target);
      if (!hit) {
        highlight.style.display = "none";
        return;
      }
      const box = hit.element.getBoundingClientRect();
      Object.assign(highlight.style, {
        display: "block",
        left: `${box.left - 2}px`,
        top: `${box.top - 2}px`,
        width: `${box.width + 4}px`,
        height: `${box.height + 4}px`,
      });
    }

    function onClick(event: MouseEvent) {
      const hit = selectionFor(event.target);
      if (!hit) return;
      event.preventDefault();
      event.stopPropagation();
      finish(hit.selection);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") finish(null);
    }

    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
  });
}
