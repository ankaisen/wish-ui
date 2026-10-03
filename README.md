# Wishkit

An open-source SDK that lets the end users of a web or Electron app reshape it by making wishes. A user selects part of the app, types something like "add priorities" or "hide the top bar", and the running app changes right away. Every change can be undone.

The developer decides what can change: one folder of the app is marked programmable, and code in it reaches the rest of the app only through a capabilities module the developer exposes.

## Status

Early work. In the web demo you can select part of the app, make a wish, and watch Claude change the programmable folder live. Wishes are saved in the browser and come back on reload. Each one can be turned off and on again, and a wish made before the app itself changed is paused until you make it again. The Electron demo does the same in a desktop app, with the API key kept out of the page.

## Using it

```ts
// vite.config.ts
import programmable from "@wishkit/vite-plugin";

export default defineConfig({
  plugins: [react(), programmable({ root: "src/programmable" })],
});
```

```tsx
// wish.ts
import { createBrowserClient, createClaudeWisher } from "@wishkit/llm";
import { createProgrammable, localApiKeyStore } from "@wishkit/react";
import files from "virtual:wishkit/programmable";

const apiKey = localApiKeyStore();

export const wish = createProgrammable({
  files,
  apiKey,
  wisher: createClaudeWisher({ client: () => createBrowserClient(apiKey.get() ?? "") }),
});

// Anywhere in the app: renders src/programmable/index.tsx, live.
<wish.Root />
// The floating "Make a wish" button.
<wish.Panel />
```

Each user's wishes are kept with the wish text as the source of truth and the changed files as a cache. They live in localStorage by default; pass `store` to keep them elsewhere. Turning a wish off also turns off the wishes built on it.

In the web demo each user enters their own Claude API key. It is kept in the browser's local storage and sent only to the Claude API. An app with its own backend can pass a client that goes through that backend instead.

Files in the programmable folder may import each other, `./capabilities` (the developer's facade onto the app, which wishes cannot change) and approved packages such as React. Anything else is rejected before a change is applied.

## Layout

| Path | Holds |
| --- | --- |
| `packages/core` | Framework-neutral runtime: compiles a user's changed files in the browser with esbuild-wasm, checks imports, swaps them in, and keeps the saved wishes |
| `packages/dom` | The wish panel (selection, wish box, undo) and browser storage, in plain DOM so every framework shares them |
| `packages/react` | `createProgrammable` and `<Root />` for React apps |
| `packages/llm` | Turns a wish into file changes with Claude, retrying when a change fails to build or render |
| `packages/vite-plugin` | Exposes the programmable folder's sources and modules to the runtime |
| `examples/web-tasks` | Web demo: a task dashboard whose task list lives in `src/programmable` |
| `examples/electron-tasks` | Electron demo: the same dashboard as a desktop app, with Node off in the page and the API key in the main process |

## Running the demo

Requires Node 22.22.2+, 24.15+ or 26+, and pnpm 10.

```sh
pnpm install
pnpm dev        # starts the web demo at http://localhost:5173
pnpm dev:electron   # builds and opens the Electron demo
pnpm test       # unit tests
pnpm typecheck
pnpm build
```

## License

[MIT](LICENSE)
