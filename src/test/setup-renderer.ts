/**
 * Global setup for renderer (jsdom) tests: jest-dom matchers plus stubs for
 * the browser/Electron APIs the app expects at runtime.
 */
// The app's ambient Window.ipcRenderer declaration (src/renderer/global.d.ts)
// is included via tsconfig.tests.json so imported source modules type-check.

import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Preload bridge stub — individual tests override invoke() as needed.
(window as unknown as { ipcRenderer: unknown }).ipcRenderer = {
  invoke: vi.fn(async () => ({ success: true, data: null })),
  send: vi.fn(),
  on: vi.fn(),
  removeAllListeners: vi.fn(),
};

// jsdom lacks these; recharts and some Radix components need them.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!('ResizeObserver' in window)) {
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
