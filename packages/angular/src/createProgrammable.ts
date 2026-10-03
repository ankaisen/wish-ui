import {
  Component,
  ElementRef,
  inject,
  Input,
  ViewChild,
  ViewContainerRef,
  type AfterViewInit,
  type ComponentRef,
  type OnDestroy,
  type OnInit,
  type Type,
} from "@angular/core";
import * as AngularCommon from "@angular/common";
import * as AngularCore from "@angular/core";
import { createWishkit, type ProgrammableOptions, type Wishkit } from "@wishkit/dom";
import wasmURL from "esbuild-wasm/esbuild.wasm?url";
import { createAngularCompiler } from "./compiler";
import { angular } from "./framework";

export type { ProgrammableOptions };

/** What createProgrammable() returns: pass it to <wish-root> and <wish-panel>. */
export type Programmable = Wishkit;

/**
 * Makes the folder in `options.files` programmable. Render it with
 * `<wish-root [wish]="wish" />` and add the panel with `<wish-panel [wish]="wish" />`.
 */
export function createProgrammable(options: ProgrammableOptions): Programmable {
  return createWishkit(options, {
    framework: angular,
    entry: "index.ts",
    packages: { "@angular/core": AngularCore, "@angular/common": AngularCommon },
    compiler: createAngularCompiler({ wasmURL }),
  });
}

/**
 * Renders the programmable entry and swaps in the user's latest version live. A version that
 * throws on its first render is replaced by a message and reported, so the runtime rolls back.
 */
@Component({
  selector: "wish-root",
  template: "<ng-container #outlet />",
  // The same attribute as ROOT_ATTRIBUTE, written out so the metadata stays static.
  host: { "data-wish-root": "", style: "display: contents" },
})
export class WishRoot implements OnInit, OnDestroy {
  @Input({ required: true }) wish!: Programmable;
  @ViewChild("outlet", { read: ViewContainerRef, static: true }) private outlet!: ViewContainerRef;
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private shown?: ComponentRef<unknown>;
  private alert?: HTMLElement;
  private unsubscribe?: () => void;

  ngOnInit() {
    this.show();
    this.unsubscribe = this.wish.runtime.subscribe(() => this.show());
    // Brings back the user's saved wishes once something is mounted to render them.
    void this.wish.wishes.ready();
  }

  ngOnDestroy() {
    this.unsubscribe?.();
  }

  private show() {
    const { runtime } = this.wish;
    const { entry, version } = runtime.getSnapshot();
    this.outlet.clear();
    this.alert?.remove();
    try {
      this.shown = this.outlet.createComponent(entry as Type<unknown>);
      this.shown.changeDetectorRef.detectChanges();
      runtime.reportRender(version);
    } catch (caught) {
      const error = caught instanceof Error ? caught : new Error(String(caught));
      this.outlet.clear();
      this.alert = this.host.ownerDocument.createElement("div");
      this.alert.setAttribute("role", "alert");
      this.alert.textContent = `This part of the app failed to render: ${error.message}`;
      this.host.append(this.alert);
      runtime.reportRender(version, error);
    }
  }
}

/** The floating panel where users select part of the app and make wishes. */
@Component({ selector: "wish-panel", template: "", host: { style: "display: contents" } })
export class WishPanel implements AfterViewInit, OnDestroy {
  @Input({ required: true }) wish!: Programmable;
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private unmount?: () => void;

  ngAfterViewInit() {
    this.unmount = this.wish.mountPanel(this.host);
  }

  ngOnDestroy() {
    this.unmount?.();
  }
}
