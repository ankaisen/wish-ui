import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi, Task } from "./api";

const keyStatus = ipcRenderer.sendSync("api-key:status") as { has: boolean; description: string };

const desktop: DesktopApi = {
  tasks: {
    list: () => ipcRenderer.invoke("tasks:list"),
    add: (title) => ipcRenderer.invoke("tasks:add", title),
    toggle: (id) => ipcRenderer.invoke("tasks:toggle", id),
    remove: (id) => ipcRenderer.invoke("tasks:remove", id),
    onChange(listener) {
      const onChanged = (_event: unknown, tasks: Task[]) => listener(tasks);
      ipcRenderer.on("tasks:changed", onChanged);
      return () => ipcRenderer.removeListener("tasks:changed", onChanged);
    },
  },
  wishes: {
    read: () => ipcRenderer.invoke("wishes:read"),
    write: (text) => ipcRenderer.invoke("wishes:write", text),
    keepUnreadable: (text) => ipcRenderer.invoke("wishes:keep-unreadable", text),
  },
  apiKey: {
    has: keyStatus.has,
    description: keyStatus.description,
    set: (key) => ipcRenderer.invoke("api-key:set", key),
  },
  claudeFetch: (request) => ipcRenderer.invoke("claude:fetch", request),
};

contextBridge.exposeInMainWorld("desktop", desktop);
