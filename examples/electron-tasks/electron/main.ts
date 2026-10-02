import { app, BrowserWindow, ipcMain, protocol, safeStorage, type IpcMainEvent, type IpcMainInvokeEvent } from "electron";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ClaudeRequest } from "./api";
import { createApiKeyStore } from "./apiKey";
import { forwardToClaude } from "./claude";
import { createTaskFile, keepUnreadable, readText, writeText } from "./files";

// The renderer is served from app://renderer/ rather than file://, so it gets a real origin
// and can fetch its own files, such as esbuild's wasm binary.
const ORIGIN = "app://renderer";
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

const RENDERER_DIR = path.join(__dirname, "../renderer");
const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

async function serveRenderer(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url);
  const file = path.normalize(path.join(RENDERER_DIR, decodeURIComponent(pathname)));
  if (!file.startsWith(RENDERER_DIR + path.sep)) return new Response("Not found", { status: 404 });
  try {
    const body = await readFile(file);
    return new Response(body, { headers: { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

/** Only the app's own page may call into the main process. */
function fromApp(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  return event.senderFrame?.url.startsWith(`${ORIGIN}/`) ?? false;
}

function handle<Args extends unknown[], Result>(
  channel: string,
  listener: (...args: Args) => Promise<Result> | Result,
) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!fromApp(event)) throw new Error(`${channel} is only available to the app`);
    return listener(...(args as Args));
  });
}

async function start() {
  const data = app.getPath("userData");
  const tasks = createTaskFile(path.join(data, "tasks.json"), randomUUID);
  const wishesFile = path.join(data, "wishes.json");
  const apiKey = await createApiKeyStore(path.join(data, "api-key"), safeStorage);

  protocol.handle("app", serveRenderer);

  function broadcast(list: Awaited<ReturnType<typeof tasks.list>>) {
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send("tasks:changed", list);
  }

  handle("tasks:list", () => tasks.list());
  handle("tasks:add", async (title: string) => broadcast(await tasks.add(String(title))));
  handle("tasks:toggle", async (id: string) => broadcast(await tasks.toggle(String(id))));
  handle("tasks:remove", async (id: string) => broadcast(await tasks.remove(String(id))));
  handle("wishes:read", () => readText(wishesFile));
  handle("wishes:write", (text: string) => writeText(wishesFile, String(text)));
  handle("wishes:keep-unreadable", (text: string) => keepUnreadable(wishesFile, String(text)));
  handle("api-key:set", (key: string | null) => apiKey.set(typeof key === "string" ? key : null));
  handle("claude:fetch", (request: ClaudeRequest) => forwardToClaude(request, apiKey.get()));
  ipcMain.on("api-key:status", (event) => {
    event.returnValue = fromApp(event) ? { has: Boolean(apiKey.get()), description: apiKey.description } : null;
  });

  const window = new BrowserWindow({
    width: 1000,
    height: 700,
    title: "Tasks",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // The app is one page; links and pop-ups never open inside it.
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  await window.loadURL(`${ORIGIN}/index.html`);
}

app.whenReady().then(start);
app.on("window-all-closed", () => app.quit());
