/// <reference types="electron" />

declare global {
  interface Window {
    ipcRenderer: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      send: (channel: string, ...args: unknown[]) => void;
      on: (channel: string, listener: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void) => () => void;
      off: (channel: string, listener: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void) => void;
    };
  }
}

export {};
