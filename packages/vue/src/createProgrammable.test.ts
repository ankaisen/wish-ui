import { createEsbuildCompiler } from "@wishkit/core";
import { afterEach, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, type App } from "vue";
import { createVueCompiler } from "./compiler";
import { createProgrammable } from "./createProgrammable";

let app: App | undefined;

afterEach(() => {
  app?.unmount();
  app = undefined;
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});

const Bundled = defineComponent({ render: () => h("p", "bundled") });
const compiler = createVueCompiler(createEsbuildCompiler());

const capabilities = { greeting: () => "hello" };

function setup(sources: Record<string, string> = {}) {
  const wish = createProgrammable({
    files: {
      sources: { "index.vue": "<template><p>bundled</p></template>", "capabilities.ts": "", ...sources },
      modules: { "index.vue": { default: Bundled }, "capabilities.ts": capabilities },
    },
    compiler,
  });
  const host = document.createElement("div");
  document.body.append(host);
  app = createApp({ render: () => h(wish.Root, { name: "Ada" }) });
  app.mount(host);
  return { ...wish, host };
}

async function settle() {
  for (let index = 0; index < 3; index++) await nextTick();
}

it("renders the bundled entry, then swaps in a compiled single-file component live", async () => {
  const { runtime, host } = setup();
  expect(host.textContent).toBe("bundled");

  const result = await runtime.apply({
    "index.vue": `<script setup lang="ts">
import { ref } from "vue";
import { greeting } from "./capabilities";
import Name from "./Name.vue";
const props = defineProps<{ name?: string }>();
const count = ref<number>(1);
</script>

<template>
  <section>
    <h2>{{ greeting() }} {{ count }}</h2>
    <Name :name="props.name" />
  </section>
</template>
`,
    "Name.vue": `<script setup lang="ts">
defineProps<{ name?: string }>();
</script>
<template><b>{{ name }}</b></template>
`,
  });
  expect(result).toEqual({ ok: true });
  await settle();

  const heading = host.querySelector("h2")!;
  expect(heading.textContent).toBe("hello 1");
  expect(heading.dataset).toMatchObject({ sourceFile: "index.vue", sourceLine: "11" });
  expect(host.querySelector("b")!.textContent).toBe("Ada");
  expect(host.querySelector("b")!.dataset).toMatchObject({ sourceFile: "Name.vue", sourceLine: "4" });
});

it("compiles components written without <script setup>", async () => {
  const { runtime, host } = setup();
  await runtime.apply({
    "index.vue": `<script lang="ts">
export default { data: () => ({ word: "options" }) };
</script>
<template><i>{{ word }}</i></template>
`,
  });
  await settle();
  expect(host.querySelector("i")!.textContent).toBe("options");
  expect(host.querySelector("i")!.dataset.sourceLine).toBe("4");
});

it("adds scoped styles to the page", async () => {
  const { runtime, host } = setup();
  await runtime.apply({
    "index.vue": `<template><p class="note">styled</p></template>
<style scoped>
.note { color: rebeccapurple; }
</style>
`,
  });
  await settle();
  const paragraph = host.querySelector("p")!;
  const scope = paragraph.getAttributeNames().find((name) => name.startsWith("data-v-"));
  expect(scope).toBeDefined();
  expect(document.head.querySelector("style")!.textContent).toContain(`.note[${scope}]`);
});

it("reports compile errors with the file and line", async () => {
  const { runtime } = setup();
  const result = await runtime.apply({ "index.vue": "<template>\n  <p>{{ broken </p>\n</template>" });
  expect(result.ok).toBe(false);
  expect(!result.ok && result.errors[0]).toMatch(/^index\.vue: line 2: /);
});

it("rejects style preprocessors", async () => {
  const { runtime } = setup();
  const result = await runtime.apply({ "index.vue": '<template><p /></template>\n<style lang="scss">p { a: b }</style>' });
  expect(result).toEqual({ ok: false, errors: ['index.vue: <style lang="scss"> isn\'t supported; use plain CSS'] });
});

it("contains a render error and brings back the previous version", async () => {
  const { runtime, host } = setup();
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const result = await runtime.tryApply({
      "index.vue": `<script setup lang="ts">
const broken = (): string => { throw new Error("broken"); };
</script>
<template><p>{{ broken() }}</p></template>
`,
    });
    expect(result).toEqual({ ok: false, errors: ["Error while rendering: broken"] });
  } finally {
    console.warn = originalWarn;
  }
  await settle();
  expect(host.textContent).toBe("bundled");
});
