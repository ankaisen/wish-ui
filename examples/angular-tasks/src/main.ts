// The demo runs Angular in JIT mode, so it needs the compiler at runtime. Wishes need it either way;
// an app built ahead of time gets it loaded by @wishkit/angular the first time a wish is compiled.
import "@angular/compiler";
import { enableProdMode } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { App } from "./App";
import "./styles.css";

if (import.meta.env.PROD) enableProdMode();

bootstrapApplication(App).catch((error: unknown) => console.error(error));
