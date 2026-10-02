# Philosophy

Why Wish UI exists and how it thinks about software. For the rules that follow from this, see [principles.md](principles.md).

## The idea

> **Make your app programmable by its users.**
> Software you can change by talking to it.

Most AI app builders help people *create* software: a user describes an application, AI builds it, and it gets deployed. Wish UI explores what happens *after* software exists and is being used. A user is already working in an app, notices something they want different, says so, and the app adapts for them.

The project is not mainly about helping people build software. It is about making software itself continuously adaptable.

## Modification first, not creation first

People are poor at answering "what application would you like to build?" They are very good at spotting local problems in something they already use:

- "Move this panel to the left."
- "I don't need this section."
- "Add priorities to tasks."
- "Turn this list into a calendar."

So the unit of interaction is not *prompt → application* but **context + intent → change**.

## The application stays the interface

The app is the primary surface. AI is a capability of the app, not a separate development environment. There is no `Chat | Code | Preview` layout, because that tells the user "you are building software". Instead, the user selects or points at something, describes the change, sees the app change, and keeps working.

## The existing interface is the prompt

A blank screen asks the user to imagine a product from nothing. An existing, working interface teaches the user what the app can do and gives them something concrete to react to. Users **learn by modifying**.

## Personal software evolves; it is not designed upfront

Nobody should have to design their ideal app on day one. Personalization grows through use: priorities on day three, a calendar in week two, the calendar removed in week four. Two users who start from the same app may end up with very different ones, and that is the point.

## Three roles

| Role | Defines |
| --- | --- |
| Developer | **The boundary**: which parts may change, what data and actions are reachable |
| End user | **The intent**: what they want different, in their own words |
| AI | **The implementation**: code that realizes the intent within the boundary |

The end user never needs to know about frameworks, files, packages, builds or deployment.

## How this differs from neighbors

| Approach | Optimizes for | Customization model |
| --- | --- | --- |
| In-browser runtimes (Sandpack, WebContainers) | Running changing code | Infrastructure, not a product |
| AI app builders | Creating software | Generate an app from a prompt |
| Low-code / no-code | Configuring software | Options the developer predicted |
| **Wish UI** | **Adapting software while it's used** | **Context + intent → bounded change** |

Low-code makes the developer define both *what* can change and *how*. Wish UI keeps the developer defining *what* (the boundary) and lets the AI handle *how*, so users are not limited to customizations someone anticipated.

## Positioning

Wish UI is **an open-source toolkit for adding end-user programmability to web applications**: an SDK first, shown through two demos (a web app and an Electron app). It is not an AI app builder and not "a sandbox plus an LLM".

## Non-goals

Wish UI should not become an IDE, a deployment or hosting platform, a website builder, a generic coding agent, a package manager UI, a Git replacement, or a full low-code platform.

## The long-term bet

What if software didn't have to be designed completely in advance? Applications could start from a useful default and adapt to each user over their lifetime, shifting software from **fixed products with customization options** toward **systems that evolve with their users**.

The first question to validate: *will users naturally treat changing software as part of using it?* Demos are a start, but the real test is an app someone uses daily for weeks, counting how often they make a wish without being prompted.
