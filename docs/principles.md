# Principles

The rules that keep Wish UI honest to its [philosophy](philosophy.md). Design and code changes should follow them; changing one is a deliberate decision, not a side effect.

## 1. Modification is contextual

A wish is the user's words plus what they selected or are looking at. "Make this smaller" is ambiguous on its own and precise with a chart selected. Prefer selection plus a short request over a large global prompt: it means less effort for the user, more precise AI instructions, fewer unintended changes, and easier undo.

In practice, selecting something in the running app maps back to its source (for example, a Vite plugin adding `data-source-file` and `data-source-line`).

## 2. The boundary is drawn around capabilities and data, not around UI

Programmability is intentional, never accidental. The developer does not list which buttons may move or which "kinds" of change are allowed (style vs logic), because that collapses into low-code and can't be enforced reliably. Instead:

- **UI inside the programmable root is fully rewritable.** Wishes may only change files under the root the developer declares (e.g. `createProgrammable({ root: "./src/programmable" })`).
- **Capabilities are the only way out.** Programmable code imports only the developer's capabilities module (e.g. `src/programmable/capabilities.ts`) and approved packages. What a wish can do is limited by what that module exposes, not by inspecting the code the AI writes.
- **A few things can be pinned** so they always stay visible (logout, billing, legal notices).
- Finer, per-component boundaries come later and follow the same rule: grant **reach** (capabilities, whether new dependencies are allowed), not change categories.

Authentication, authorization, payments, security controls and critical business rules stay in the stable core, outside the boundary.

## 3. User data can grow but never shrinks or changes shape silently

The interface is disposable; user data is durable. A wish may add user-owned data (for example, a priority field on tasks). It may never delete or migrate existing data without the user explicitly confirming. "Remove the calendar" hides a view; it never deletes events.

## 4. The wish is the source of truth; code is a cache

Each change is stored as the user's intent plus its context (selection, base version), not only as a code diff. This is what lets changes survive the developer shipping a new version: the AI re-applies the wish to the new base. It also allows consolidating many small changes into clean code later.

## 5. Changes are per user and never touch the app's real source in production

Each user's changes live in a per-user overlay of the programmable files, stored with their wishes and compiled in the browser. Editing real source files is only a development convenience.

## 6. Every change is reversible

Reversibility is part of the trust model, not a convenience: people only experiment when mistakes are cheap. Changes are described in user terms ("Added priorities to Tasks", "Removed Calendar"), not commits. Users can undo, restore earlier states, and switch individual changes off without losing later ones. If a change breaks the app, it falls back to the last working state.

## 7. "I can't do that" is a designed answer

Some wishes will fall outside the boundary. The system explains what is protected and offers the nearest allowed alternative instead of failing silently. Done well, this teaches users the boundary the same way the existing interface teaches what the app can do.

## 8. Development infrastructure stays invisible

Bundlers, packages, source files and history exist underneath but are implementation details. Nothing in the end-user experience should feel like "developer mode".
