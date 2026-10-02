# Wish UI

An open-source SDK that lets the end users of a web or Electron app reshape it by making wishes. A user selects part of the app, types something like "add priorities" or "hide the top bar", and the running app changes right away. Every change can be undone.

The developer decides what can change: one folder of the app is marked programmable, and code in it reaches the rest of the app only through a capabilities module the developer exposes.

## Status

Early work. The repository currently holds the web demo, a small task dashboard, as a plain React app. The SDK packages come next.

## Layout

| Path | Holds |
| --- | --- |
| `examples/web-tasks` | Web demo: a task dashboard whose task list lives in `src/programmable` |
| `packages/` | SDK packages (coming next) |

## Running the demo

Requires Node 22.22.2+, 24.15+ or 26+, and pnpm 10.

```sh
pnpm install
pnpm dev        # starts the web demo at http://localhost:5173
pnpm test       # unit tests
pnpm typecheck
pnpm build
```
