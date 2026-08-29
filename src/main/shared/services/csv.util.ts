import { BrowserWindow, app, dialog } from 'electron';
import path from 'path';
import fs from 'fs';

/** Escapes one CSV cell (quotes anything containing separators/quotes/newlines). */
export function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvRow(...cols: unknown[]): string {
  return cols.map(csvCell).join(',');
}

/**
 * Opens a native save dialog (defaulting to Downloads) and writes the CSV with
 * a UTF-8 BOM so Excel renders accents correctly.
 * Returns { canceled: true } when the user dismisses the dialog.
 */
export async function saveCsv(
  defaultFileName: string,
  lines: string[],
): Promise<{ success: boolean; filePath?: string; canceled?: boolean; message?: string }> {
  try {
    const win = BrowserWindow.getAllWindows()[0];
    const options = {
      title: 'Exportar CSV',
      defaultPath: path.join(app.getPath('downloads'), defaultFileName),
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    };
    // Cast: this Electron version's typings declare the legacy string return
    const result = (win
      ? await (dialog.showSaveDialog as any)(win, options)
      : await (dialog.showSaveDialog as any)(options)) as { canceled: boolean; filePath?: string };

    if (result.canceled || !result.filePath) return { success: false, canceled: true };

    fs.writeFileSync(result.filePath, '\uFEFF' + lines.join('\n'), 'utf8');
    return { success: true, filePath: result.filePath };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
