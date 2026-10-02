# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository.

## What this is

Wish UI is an open-source SDK that lets the end users of a React app, on the web or in Electron, reshape it by making wishes in natural language. The developer marks one folder as programmable; an LLM rewrites files in that folder, and the running app updates live. See `README.md`.

## Philosophy and principles

Read [docs/philosophy.md](docs/philosophy.md) and [docs/principles.md](docs/principles.md) before making design decisions. In short:

- **Adaptation, not creation.** Users change software they already use: context + intent → change. The app stays the interface; AI is a capability of it, never a "developer mode".
- **The developer draws the boundary.** Only files under the programmable root (e.g. `src/programmable`) may be changed by wishes.
- **Capabilities are the only way out.** Programmable files import only the developer's capabilities module (e.g. `src/programmable/capabilities.ts`) and approved packages such as React. Never import app internals from a programmable file. Boundaries grant reach, not kinds of change.
- **Changes are contextual.** A wish is the user's words plus their selection in the running app, mapped back to source.
- **The wish is the source of truth; code is a cache.** Each user's changes live in a per-user overlay stored with their wishes, never as edits to the app's real source in production.
- **User data can grow but never shrinks or changes shape** without the user confirming.
- **Every change is reversible**, and a wish outside the boundary gets a clear explanation, not a silent failure.

## Repository layout

| Path | Holds |
| --- | --- |
| `docs/` | Philosophy and principles |
| `packages/*` | SDK packages |
| `examples/*` | Demo apps (web and Electron) |

## Commands

Requires Node 22+ and pnpm 10. Run from the repository root:

```sh
pnpm install
pnpm dev        # web demo
pnpm test
pnpm typecheck
pnpm build
```

Run `pnpm typecheck` and `pnpm test` before every commit.

## Conventions

- **TypeScript, strict mode.** React function components and hooks.
- **Conventional Commits** for every commit message and PR title: `type(scope): summary`, lower-case summary in the imperative, no trailing period.
  - Types: `feat`, `fix`, `docs`, `refactor`, `test`, `build`, `ci`, `chore`, `perf`, `style`.
  - Scope is the package or example name when one applies, e.g. `feat(web-tasks): add task filters`, `fix(core): keep overlay order stable`.
  - Breaking changes use `!` after the type or scope and a `BREAKING CHANGE:` footer.
- Keep changes small and focused; add or update tests with behavior changes.
