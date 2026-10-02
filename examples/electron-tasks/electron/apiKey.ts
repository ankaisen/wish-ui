import { unlink } from "node:fs/promises";
import { readText, writeText } from "./files";

/** The parts of Electron's safeStorage this uses, so it can be faked in tests. */
export type Encryption = {
  isEncryptionAvailable(): boolean;
  encryptString(text: string): Buffer;
  decryptString(data: Buffer): string;
};

/**
 * Holds the Claude API key in the main process. ANTHROPIC_API_KEY wins when set. Otherwise a
 * key the user enters is saved encrypted with the system keychain, or, where there is no
 * keychain, kept in memory until the app quits.
 */
export async function createApiKeyStore(file: string, encryption: Encryption, env = process.env) {
  const fromEnv = env.ANTHROPIC_API_KEY || null;
  const canSave = encryption.isEncryptionAvailable();
  let key: string | null = fromEnv;
  if (!key && canSave) {
    try {
      const saved = await readText(file);
      key = saved ? encryption.decryptString(Buffer.from(saved, "base64")) : null;
    } catch {
      key = null;
    }
  }

  return {
    get: () => key,
    description: canSave
      ? "It is encrypted with your system keychain and used only by the app's main process."
      : "It is kept by the app's main process until you quit.",
    async set(next: string | null) {
      key = next || fromEnv;
      if (!canSave) return;
      if (next) await writeText(file, encryption.encryptString(next).toString("base64"));
      else await unlink(file).catch(() => undefined);
    },
  };
}
