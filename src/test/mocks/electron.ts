/**
 * Electron stub for backend tests. The `electron` import is aliased to this
 * module by vitest.config.ts, so TypeORM services run under plain Node against
 * an isolated temp directory (fresh per worker → per test file).
 */
import path from 'path';
import fs from 'fs';
import os from 'os';

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'venilu-test-'));

export const app = {
  getPath: (_name?: string) => testRoot,
  getVersion: () => '0.0.0-test',
  whenReady: () => Promise.resolve(),
  on: () => app,
  quit: () => {},
};

export const ipcMain = {
  handle: (_channel: string, _fn: unknown) => {},
  on: (_channel: string, _fn: unknown) => {},
  removeHandler: (_channel: string) => {},
};

export class BrowserWindow {
  static getAllWindows() { return []; }
  loadURL() { return Promise.resolve(); }
  close() {}
  webContents = { printToPDF: async () => Buffer.alloc(0), send: () => {} };
}

export const dialog = {
  showSaveDialog: async () => ({ canceled: true, filePath: undefined }),
  showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
};

export const protocol = {
  registerSchemesAsPrivileged: () => {},
  handle: () => {},
};

export const net = {
  fetch: async () => new Response(null, { status: 404 }),
};

export default { app, ipcMain, BrowserWindow, dialog, protocol, net };
