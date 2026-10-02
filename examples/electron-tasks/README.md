# Electron demo

The task dashboard from `examples/web-tasks` as a desktop app. It shows how Wishkit fits an Electron app without loosening Electron's security defaults.

```sh
pnpm install
pnpm dev:electron        # from the repository root
```

Set `ANTHROPIC_API_KEY` before starting, or enter a key in the wish panel.

## How it is put together

| Part | Runs in | Does |
| --- | --- | --- |
| `src/` | Renderer (the page) | The app and the wish panel. Wishes are compiled and run here, in a sandboxed page with no Node.js access. |
| `src/programmable/capabilities.ts` | Renderer | The only way programmable code reaches the app: list, add, toggle and remove tasks. Each call goes to the main process. |
| `electron/preload.ts` | Preload | Exposes `window.desktop`, a fixed set of calls into the main process. |
| `electron/main.ts` | Main process | Keeps tasks and wishes in JSON files in the app's data folder, holds the API key, and serves the page from `app://renderer/`. |
| `electron/claude.ts` | Main process | Sends the renderer's Claude API requests with the key added, and refuses any other destination. |

The key never reaches the page. With a system keychain it is saved encrypted (Electron's `safeStorage`); without one it lasts until the app quits. The page's Content Security Policy allows `unsafe-eval`, because wishes are compiled and evaluated in the page, and allows no network access of its own.
