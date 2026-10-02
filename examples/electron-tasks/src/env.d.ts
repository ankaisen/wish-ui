import type { DesktopApi } from "../electron/api";

declare global {
  interface Window {
    /** Set by the preload script. */
    desktop: DesktopApi;
  }
}
