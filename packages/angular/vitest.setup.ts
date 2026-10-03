// esbuild-wasm checks that TextEncoder output is an instance of the global Uint8Array.
// Under jsdom the two come from different realms, so re-wrap the bytes in this realm's Uint8Array.
import { TextEncoder as NodeTextEncoder } from "node:util";

class TextEncoder extends NodeTextEncoder {
  encode(input?: string) {
    return new Uint8Array(super.encode(input));
  }
}

Object.assign(globalThis, { TextEncoder });
