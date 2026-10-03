const ATTRIBUTE = "data-wishkit-style";

/**
 * Puts compiled <style> blocks on the page. Scoped CSS is kept per version of a file, since its
 * selectors only match that version's elements, so a version that fails and is rolled back
 * never takes the styles of the one still showing. Global CSS is kept per file, newest wins.
 */
export function createStyles(document: Document) {
  const elements = new Map<string, HTMLStyleElement>();

  function set(key: string, css: string) {
    let element = elements.get(key);
    if (!element) {
      if (!css) return;
      element = document.createElement("style");
      element.setAttribute(ATTRIBUTE, key);
      document.head.append(element);
      elements.set(key, element);
    }
    element.textContent = css;
  }

  return {
    addStyles(path: string, scopeId: string, scoped: string, global: string) {
      set(`${path} ${scopeId}`, scoped);
      set(path, global);
    },
  };
}
