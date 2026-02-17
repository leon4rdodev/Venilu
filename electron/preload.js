const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe, limited API to the renderer process via contextBridge.
// This keeps contextIsolation: true while providing the same window.ipcRenderer interface.
contextBridge.exposeInMainWorld('ipcRenderer', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  on: (channel, listener) => {
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  off: (channel, listener) => {
    ipcRenderer.removeListener(channel, listener);
  },
});
