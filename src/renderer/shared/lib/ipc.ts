// Use a getter so we always pick up ipcRenderer even if the preload script
// injects it after this module is first evaluated.
export const ipc: typeof window.ipcRenderer = new Proxy({} as typeof window.ipcRenderer, {
  get(_target, prop: string) {
    if (window.ipcRenderer) {
      const value = (window.ipcRenderer as any)[prop];
      // Bind functions so `this` stays correct
      return typeof value === 'function' ? value.bind(window.ipcRenderer) : value;
    }
    // Fallback: return no-ops / rejected promises so callers don't crash
    if (prop === 'invoke') return (..._args: unknown[]) => Promise.reject(new Error('ipcRenderer not available'));
    if (prop === 'send') return () => { console.warn('[ipc] send called but ipcRenderer not available'); };
    if (prop === 'on') return () => () => {}; // returns unsubscribe fn
    if (prop === 'off') return () => {};
    return undefined;
  },
});
