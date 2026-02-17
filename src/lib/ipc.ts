export const ipc = window.ipcRenderer ? window.ipcRenderer : {
  send: () => {
    throw new Error("ipcRenderer not available");
  },
  on: () => {
    throw new Error("ipcRenderer not available");
  },
  off: () => {
    throw new Error("ipcRenderer not available");
  },
  invoke: () => {
    throw new Error("ipcRenderer not available");
  },
};
