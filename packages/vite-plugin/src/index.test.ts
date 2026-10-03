import { expect, it } from "vitest";
import { normalizeRoot, virtualModuleCode } from "./index";

it("normalizes the root", () => {
  expect(normalizeRoot("./src/programmable/")).toBe("src/programmable");
  expect(normalizeRoot("/src/programmable")).toBe("src/programmable");
});

it("globs the root's sources and modules, leaving out tests and declarations", () => {
  const code = virtualModuleCode("./src/programmable");
  expect(code).toContain('"/src/programmable/**/*.{ts,tsx,vue}"');
  expect(code).toContain('"!/src/programmable/**/*.test.{ts,tsx,vue}"');
  expect(code).toContain('query: "?raw"');
  expect(code).toContain('root: "src/programmable"');
});

it("globs only the file types given", () => {
  expect(virtualModuleCode("src/programmable", ["ts"])).toContain('"/src/programmable/**/*.ts"');
});
