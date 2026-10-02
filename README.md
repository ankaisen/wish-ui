# Wish UI

An open-source SDK that lets the end users of a web or Electron app reshape it by making wishes. A user selects part of the app, types something like "add priorities" or "hide the top bar", and the running app changes right away. Every change can be undone.

The developer decides what can change: one folder of the app is marked programmable, and code in it reaches the rest of the app only through a capabilities module the developer exposes.

## Status

Early work. The SDK can load an app's programmable folder and swap in a changed version of its files live. Wishes, selection and undo come next.

## Using it

```ts
// vite.config.ts
import programmable from "@wish-ui/vite-plugin";

export default defineConfig({
  plugins: [react(), programmable({ root: "src/programmable" })],
});
```

```tsx
// wish.ts
import { createProgrammable } from "@wish-ui/react";
import files from "virtual:wish-ui/programmable";

export const wish = createProgrammable({ files });

// Anywhere in the app: renders src/programmable/index.tsx, live.
<wish.Root />
```

Files in the programmable folder may import each other, `./capabilities` (the developer's facade onto the app, which wishes cannot change) and approved packages such as React. Anything else is rejected before a change is applied.

## Layout

| Path | Holds |
| --- | --- |
| `packages/core` | Runtime: compiles a user's changed files in the browser with esbuild-wasm, checks imports, swaps them in |
| `packages/react` | `createProgrammable` and `<Root />` |
| `packages/vite-plugin` | Exposes the programmable folder's sources and modules to the runtime |
| `examples/web-tasks` | Web demo: a task dashboard whose task list lives in `src/programmable` |

## Running the demo

Requires Node 22.22.2+, 24.15+ or 26+, and pnpm 10.

```sh
pnpm install
pnpm dev        # starts the web demo at http://localhost:5173
pnpm test       # unit tests
pnpm typecheck
pnpm build
```
