import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createApiKeyStore } from "./apiKey";
import { createTaskFile } from "./files";

async function tempFile(name: string) {
  return path.join(await mkdtemp(path.join(tmpdir(), "electron-tasks-")), name);
}

describe("task file", () => {
  it("starts with the seed tasks and saves changes", async () => {
    const file = await tempFile("tasks.json");
    let id = 0;
    const tasks = createTaskFile(file, () => `new-${++id}`);
    expect((await tasks.list()).map((task) => task.title)).toEqual(["Buy groceries", "Finish report", "Read paper"]);

    await Promise.all([tasks.add("Call mum"), tasks.toggle("1"), tasks.remove("3")]);
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual([
      { id: "1", title: "Buy groceries", done: true },
      { id: "2", title: "Finish report", done: false },
      { id: "new-1", title: "Call mum", done: false },
    ]);
  });

  it("keeps a file it can't read instead of overwriting it", async () => {
    const file = await tempFile("tasks.json");
    await writeFile(file, "{ broken");
    const tasks = createTaskFile(file, () => "x");
    expect(await tasks.list()).toHaveLength(3);
    const kept = (await readdir(path.dirname(file))).filter((name) => name.startsWith("tasks.json.unreadable-"));
    expect(kept).toHaveLength(1);
  });
});

const fakeKeychain = {
  isEncryptionAvailable: () => true,
  encryptString: (text: string) => Buffer.from(`sealed:${text}`),
  decryptString: (data: Buffer) => data.toString().replace(/^sealed:/, ""),
};

describe("API key store", () => {
  it("saves the key encrypted and reads it back", async () => {
    const file = await tempFile("api-key");
    const store = await createApiKeyStore(file, fakeKeychain, {});
    await store.set("sk-ant-saved");
    expect(await readFile(file, "utf8")).not.toContain("sk-ant-saved");
    expect((await createApiKeyStore(file, fakeKeychain, {})).get()).toBe("sk-ant-saved");

    await store.set(null);
    expect((await createApiKeyStore(file, fakeKeychain, {})).get()).toBeNull();
  });

  it("prefers ANTHROPIC_API_KEY and keeps a key only in memory without a keychain", async () => {
    const file = await tempFile("api-key");
    expect((await createApiKeyStore(file, fakeKeychain, { ANTHROPIC_API_KEY: "sk-ant-env" })).get()).toBe("sk-ant-env");

    const noKeychain = { ...fakeKeychain, isEncryptionAvailable: () => false };
    const store = await createApiKeyStore(file, noKeychain, {});
    await store.set("sk-ant-memory");
    expect(store.get()).toBe("sk-ant-memory");
    expect(await readdir(path.dirname(file))).toEqual([]);
  });
});
