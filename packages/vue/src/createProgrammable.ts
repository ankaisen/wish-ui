import { createEsbuildCompiler } from "@wishkit/core";
import { createWishkit, ROOT_ATTRIBUTE, type ProgrammableOptions } from "@wishkit/dom";
import wasmURL from "esbuild-wasm/esbuild.wasm?url";
import * as Vue from "vue";
import {
  defineComponent,
  h,
  onBeforeUnmount,
  onErrorCaptured,
  onMounted,
  ref,
  shallowRef,
  type Component,
} from "vue";
import { createVueCompiler, STYLES_MODULE } from "./compiler";
import { vue } from "./framework";
import { createStyles } from "./styles";

export type { ProgrammableOptions };

export function createProgrammable(options: ProgrammableOptions) {
  const { runtime, wishes, mountPanel } = createWishkit(options, {
    framework: vue,
    entry: "index.vue",
    packages: { vue: Vue },
    internal: { [STYLES_MODULE]: createStyles(document) },
    compiler: createVueCompiler(createEsbuildCompiler({ wasmURL })),
  });

  /** Shows one version of the entry. A render error stays inside it and is reported, so the runtime can roll back. */
  const Boundary = defineComponent({
    name: "WishBoundary",
    props: { version: { type: Number, required: true } },
    setup(props, { slots }) {
      const error = shallowRef<Error | null>(null);
      onErrorCaptured((caught) => {
        error.value = caught instanceof Error ? caught : new Error(String(caught));
        runtime.reportRender(props.version, error.value);
        return false;
      });
      onMounted(() => runtime.reportRender(props.version));
      return () =>
        error.value
          ? h("div", { role: "alert" }, `This part of the app failed to render: ${error.value.message}`)
          : slots.default?.();
    },
  });

  /** Renders the programmable entry, swapping in the user's latest version live. Attributes pass through. */
  const Root = defineComponent({
    name: "WishRoot",
    inheritAttrs: false,
    setup(_, { attrs }) {
      const snapshot = shallowRef(runtime.getSnapshot());
      const unsubscribe = runtime.subscribe(() => (snapshot.value = runtime.getSnapshot()));
      onBeforeUnmount(unsubscribe);
      // Brings back the user's saved wishes once something is mounted to render them.
      onMounted(() => void wishes.ready());
      return () => {
        const { entry, version } = snapshot.value;
        return h("div", { [ROOT_ATTRIBUTE]: "", style: "display: contents" }, [
          h(Boundary, { key: version, version }, () => h(entry as Component, attrs)),
        ]);
      };
    },
  });

  /** The floating panel where users select part of the app and make wishes. */
  const Panel = defineComponent({
    name: "WishPanel",
    setup() {
      const host = ref<HTMLElement>();
      let unmount: (() => void) | undefined;
      onMounted(() => (unmount = mountPanel(host.value!)));
      onBeforeUnmount(() => unmount?.());
      return () => h("div", { ref: host, style: "display: contents" });
    },
  });

  return { runtime, wishes, Root, Panel };
}
