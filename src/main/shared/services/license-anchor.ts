import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Redundant licensing anchor kept OUTSIDE userData, so wiping the app's data
 * folder (or reinstalling) neither restarts the free trial nor forgets the
 * clock high-water mark. It mirrors what the database holds; at boot both
 * copies are reconciled and the most restrictive value wins.
 *
 * The HMAC only deters hand-editing: the secret ships inside the app, so it
 * stops a curious user with a text editor, not someone reverse-engineering
 * the bundle (nothing client-side can).
 */
const ANCHOR_SECRET = 'vnl-anchor-v1:8f2c41d7a9e35b60c4d1f7a2938e6b05';

export interface LicenseAnchor {
  /** ISO timestamp of the first boot ever seen on this machine. */
  trialStartedAt: string | null;
  /** Clock high-water mark (ISO) — the latest moment the app has witnessed. */
  lastSeenAt: string | null;
  /** License ids ever activated here (a NEW id may reset the clock guard). */
  seenIds: string[];
}

export const EMPTY_ANCHOR: LicenseAnchor = { trialStartedAt: null, lastSeenAt: null, seenIds: [] };

/** Per-user, non-roaming location that uninstallers/"clear app data" don't touch. */
export function defaultAnchorPath(): string {
  const home = os.homedir();
  const base =
    process.platform === 'win32'
      ? process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local')
      : process.platform === 'darwin'
        ? path.join(home, 'Library', 'Application Support')
        : process.env.XDG_DATA_HOME || path.join(home, '.local', 'share');
  return path.join(base, '.vnl-state', 'anchor.dat');
}

function sign(body: string): string {
  return crypto.createHmac('sha256', ANCHOR_SECRET).update(body).digest('base64url');
}

/** Returns null when the file is missing, corrupt or hand-edited. */
export function readAnchor(file: string = defaultAnchorPath()): LicenseAnchor | null {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (typeof raw?.body !== 'string' || typeof raw?.mac !== 'string') return null;
    const expected = Buffer.from(sign(raw.body));
    const given = Buffer.from(raw.mac);
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;

    const data = JSON.parse(raw.body);
    return {
      trialStartedAt: typeof data.trialStartedAt === 'string' ? data.trialStartedAt : null,
      lastSeenAt: typeof data.lastSeenAt === 'string' ? data.lastSeenAt : null,
      seenIds: Array.isArray(data.seenIds) ? data.seenIds.filter((x: unknown) => typeof x === 'string') : [],
    };
  } catch {
    return null;
  }
}

/** Best-effort: licensing must never crash the POS because a folder is read-only. */
export function writeAnchor(anchor: LicenseAnchor, file: string = defaultAnchorPath()): boolean {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const body = JSON.stringify(anchor);
    fs.writeFileSync(file, JSON.stringify({ body, mac: sign(body) }), 'utf8');
    return true;
  } catch (err) {
    console.error('[License] Could not persist anchor:', err);
    return false;
  }
}
