import { contextBridge, ipcRenderer } from 'electron';

// Expose a safe, limited API to the renderer process via contextBridge.
contextBridge.exposeInMainWorld('ipcRenderer', {
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
  on: (channel: string, listener: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (event, ...args) => listener(...args));
    return () => ipcRenderer.removeListener(channel, listener);
  },
  off: (channel: string, listener: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, listener);
  },
});
