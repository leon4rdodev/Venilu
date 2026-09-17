import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { AppDataSource } from '@main/config/data-source';
import { Setting } from '@main/modules/settings/entities/setting.entity';
import { EMPTY_ANCHOR, LicenseAnchor, defaultAnchorPath, readAnchor, writeAnchor } from './license-anchor';

/**
 * Offline licensing: keys are Ed25519-SIGNED payloads issued with
 * scripts/generar-licencia.mjs (private key lives OUTSIDE the repo, in
 * ~/.venilu-licencias). The app only embeds the public key below — a valid
 * signature cannot be forged without the private key.
 *
 * Key format:  VNL-<base64url(payload JSON)>.<base64url(signature)>
 * Payload:     { id, customer, business?, type: 'perpetua'|'anual',
 *                issued: 'YYYY-MM-DD', expires?: 'YYYY-MM-DD' }
 *
 * Sin licencia: 15 días de prueba completa (para demos); al vencer la prueba
 * o una licencia anual, el POS bloquea el COBRO (process-sale) — los datos
 * siguen visibles y exportables, nunca se secuestran.
 *
 * Anti-tamper (deterrents, not DRM): the trial start and a clock high-water
 * mark live BOTH in the database and in a signed anchor file outside userData
 * (license-anchor.ts). The earliest trial start / latest high-water wins, and
 * setting the system clock back past the tolerance blocks charging until the
 * date is fixed. Perpetual licenses are exempt — they gain nothing from it.
 */
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAhCkozB2R3/k5RgYYBWs+s2DAWhawNQJpGd9tPSd/HXA=
-----END PUBLIC KEY-----`;

export const TRIAL_DAYS = 15;
/** Slack for legit clock fixes (dead CMOS battery, manual corrections). */
export const CLOCK_TOLERANCE_MS = 24 * 60 * 60 * 1000;
/** A never-seen key issued this recently may reset the clock guard (support path). */
const FRESH_KEY_DAYS = 30;
const PERSIST_EVERY_MS = 60_000;

export interface LicensePayload {
  id: string;
  customer: string;
  business?: string;
  type: 'perpetua' | 'anual';
  issued: string;
  expires?: string;
}

export interface LicenseStatus {
  state: 'trial' | 'active' | 'expired' | 'trial_expired' | 'clock_rollback';
  /** Sales blocked? (expired annual / trial over / system clock set back) */
  blocked: boolean;
  license?: LicensePayload;
  trialDaysLeft?: number;
  /** Days until an annual license expires (for renewal warnings). */
  daysToExpiry?: number;
}

/** Verifies signature + shape. Returns the payload or throws in Spanish. */
export function verifyLicenseKey(key: string, publicKeyPem: string = PUBLIC_KEY_PEM): LicensePayload {
  const trimmed = String(key ?? '').trim();
  if (!trimmed.startsWith('VNL-')) {
    throw new Error('Formato de licencia inválido');
  }
  const body = trimmed.slice(4);
  const dot = body.indexOf('.');
  if (dot < 0) throw new Error('Formato de licencia inválido');

  const payloadB64 = body.slice(0, dot);
  const sigB64 = body.slice(dot + 1);

  let payloadRaw: Buffer;
  let signature: Buffer;
  let payload: LicensePayload;
  try {
    payloadRaw = Buffer.from(payloadB64, 'base64url');
    signature = Buffer.from(sigB64, 'base64url');
    payload = JSON.parse(payloadRaw.toString('utf8'));
  } catch {
    throw new Error('La clave de licencia está dañada o incompleta');
  }

  const valid = crypto.verify(null, payloadRaw, publicKeyPem, signature);
  if (!valid) throw new Error('La firma de la licencia no es válida');

  if (!payload || typeof payload.customer !== 'string' || !payload.customer ||
      (payload.type !== 'perpetua' && payload.type !== 'anual')) {
    throw new Error('El contenido de la licencia no es válido');
  }
  if (payload.type === 'anual' && !payload.expires) {
    throw new Error('Una licencia anual debe tener fecha de vencimiento');
  }
  return payload;
}

function toMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/** Earliest valid ISO timestamp of the two (null when neither is valid). */
export function earliestIso(a: string | null | undefined, b: string | null | undefined): string | null {
  const [x, y] = [toMs(a), toMs(b)];
  if (x === null) return y === null ? null : b!;
  if (y === null) return a!;
  return x <= y ? a! : b!;
}

/** Latest valid ISO timestamp of the two (null when neither is valid). */
export function latestIso(a: string | null | undefined, b: string | null | undefined): string | null {
  const [x, y] = [toMs(a), toMs(b)];
  if (x === null) return y === null ? null : b!;
  if (y === null) return a!;
  return x >= y ? a! : b!;
}

/**
 * Moves the high-water mark forward. It follows the wall clock, but never
 * advances by less than the time the app has actually been running — so a
 * clock that stays set back still burns license time while the POS is in use.
 */
export function advanceHighWater(prev: string | null, now: Date, elapsedMs: number): string {
  const prevMs = toMs(prev);
  if (prevMs === null) return now.toISOString();
  return new Date(Math.max(now.getTime(), prevMs + Math.max(0, elapsedMs))).toISOString();
}

export function isClockRolledBack(lastSeenAt: string | null, now: Date): boolean {
  const seen = toMs(lastSeenAt);
  return seen !== null && now.getTime() < seen - CLOCK_TOLERANCE_MS;
}

/** Pure status derivation — unit-testable with an injected clock. */
export function computeStatus(
  license: LicensePayload | null,
  trialStartedAt: string | null,
  now: Date = new Date(),
  lastSeenAt: string | null = null,
): LicenseStatus {
  if (license?.type === 'perpetua') {
    return { state: 'active', blocked: false, license };
  }

  if (isClockRolledBack(lastSeenAt, now)) {
    return { state: 'clock_rollback', blocked: true, ...(license ? { license } : {}) };
  }
  // Inside the tolerance the high-water mark still rules: time never rewinds.
  const seen = toMs(lastSeenAt);
  if (seen !== null && seen > now.getTime()) now = new Date(seen);

  if (license) {
    const expires = new Date(`${license.expires}T23:59:59`);
    if (isNaN(expires.getTime()) || now > expires) {
      return { state: 'expired', blocked: true, license };
    }
    const daysToExpiry = Math.ceil((expires.getTime() - now.getTime()) / 86_400_000);
    return { state: 'active', blocked: false, license, daysToExpiry };
  }

  const started = trialStartedAt ? new Date(trialStartedAt) : now;
  const elapsedDays = Math.floor((now.getTime() - started.getTime()) / 86_400_000);
  const trialDaysLeft = Math.max(0, TRIAL_DAYS - elapsedDays);
  if (trialDaysLeft > 0) {
    return { state: 'trial', blocked: false, trialDaysLeft };
  }
  return { state: 'trial_expired', blocked: true, trialDaysLeft: 0 };
}

export class LicenseService {
  /** performance.now() of the last high-water persist (monotonic, clock-proof). */
  private lastPersistMono: number | null = null;

  private licenseFile(): string {
    return path.join(app.getPath('userData'), 'license.json');
  }

  /** Dev runs keep their anchor with the dev data so they never touch the real one. */
  private anchorFile(): string {
    return app.isPackaged ? defaultAnchorPath() : path.join(app.getPath('userData'), 'dev-anchor.dat');
  }

  private readStoredKey(): string | null {
    try {
      const raw = JSON.parse(fs.readFileSync(this.licenseFile(), 'utf8'));
      return typeof raw?.key === 'string' ? raw.key : null;
    } catch {
      return null;
    }
  }

  private storedLicense(): LicensePayload | null {
    const key = this.readStoredKey();
    if (!key) return null;
    try {
      return verifyLicenseKey(key);
    } catch {
      return null; // tampered/corrupt stored key → back to trial rules
    }
  }

  /**
   * Reconciles the two copies (database row + anchor file outside userData)
   * and writes back whatever is out of date. Most restrictive value wins:
   * EARLIEST trial start, LATEST clock high-water mark.
   */
  private async syncAnchors(
    patch: { lastSeenAt?: string; addId?: string } = {},
  ): Promise<{ trialStartedAt: string | null; lastSeenAt: string | null; anchor: LicenseAnchor }> {
    const repo = AppDataSource.getRepository(Setting);
    const settings = await repo.findOneBy({ id: 1 });
    const anchor = readAnchor(this.anchorFile()) ?? EMPTY_ANCHOR;

    const trialStartedAt = earliestIso(settings?.trial_started_at, anchor.trialStartedAt);
    const lastSeenAt = patch.lastSeenAt ?? latestIso(settings?.license_last_seen_at, anchor.lastSeenAt);
    const seenIds = patch.addId && !anchor.seenIds.includes(patch.addId)
      ? [...anchor.seenIds, patch.addId]
      : anchor.seenIds;

    if (settings) {
      // Column-level update: never clobbers a concurrent settings save
      const changes: Partial<Setting> = {};
      if (trialStartedAt && settings.trial_started_at !== trialStartedAt) changes.trial_started_at = trialStartedAt;
      if (lastSeenAt && settings.license_last_seen_at !== lastSeenAt) changes.license_last_seen_at = lastSeenAt;
      if (Object.keys(changes).length > 0) await repo.update({ id: 1 }, changes);
    }

    const next: LicenseAnchor = { trialStartedAt, lastSeenAt, seenIds };
    if (next.trialStartedAt !== anchor.trialStartedAt || next.lastSeenAt !== anchor.lastSeenAt ||
        next.seenIds !== anchor.seenIds) {
      writeAnchor(next, this.anchorFile());
    }
    return { trialStartedAt, lastSeenAt, anchor: next };
  }

  /** Called once at boot: anchors the trial start on first run. */
  async ensureTrialStarted(): Promise<void> {
    const repo = AppDataSource.getRepository(Setting);
    let settings = await repo.findOneBy({ id: 1 });
    if (!settings) {
      settings = repo.create({ id: 1, business_name: 'Venilu', paper_size: '80mm' });
      await repo.save(settings);
    }

    // A wiped userData (fresh DB) inherits the trial start from the anchor
    // file; a missing/edited anchor is rebuilt from the database.
    const { trialStartedAt } = await this.syncAnchors({ addId: this.storedLicense()?.id });
    if (!trialStartedAt) {
      const now = new Date().toISOString();
      await repo.update({ id: 1 }, { trial_started_at: now });
      await this.syncAnchors();
    }
    await this.touchClock();
  }

  /**
   * Advances the clock high-water mark (throttled). Runs on every status
   * check and on a timer from main.ts.
   */
  async touchClock(now: Date = new Date()): Promise<{ trialStartedAt: string | null; lastSeenAt: string | null }> {
    const current = await this.syncAnchors();
    const mono = performance.now();
    if (this.lastPersistMono === null) this.lastPersistMono = mono;

    const prev = current.lastSeenAt;
    const next = advanceHighWater(prev, now, mono - this.lastPersistMono);
    if (prev && Date.parse(next) - Date.parse(prev) < PERSIST_EVERY_MS) return current;

    this.lastPersistMono = mono;
    return this.syncAnchors({ lastSeenAt: next });
  }

  async getStatus(): Promise<LicenseStatus> {
    const license = this.storedLicense();
    const now = new Date();
    const { trialStartedAt, lastSeenAt } = await this.touchClock(now);
    return computeStatus(license, trialStartedAt, now, lastSeenAt);
  }

  /** Validates and persists a key. Throws (in Spanish) when it's not usable. */
  async activate(key: string): Promise<LicenseStatus> {
    const payload = verifyLicenseKey(key);
    const now = new Date();
    const { lastSeenAt, anchor } = await this.syncAnchors();

    // Support path for a clock that was wrongly set FORWARD once (high-water
    // stuck in the future): a freshly issued key never activated here resets
    // the guard. Old or already-seen keys can't, so they don't undo a rollback.
    const issuedMs = Date.parse(`${payload.issued}T00:00:00`);
    const ageDays = (now.getTime() - issuedMs) / 86_400_000;
    const resetsGuard = !anchor.seenIds.includes(payload.id) && ageDays >= -1 && ageDays <= FRESH_KEY_DAYS;

    const status = computeStatus(payload, null, now, resetsGuard ? null : lastSeenAt);
    if (status.state === 'expired') {
      throw new Error(`Esta licencia venció el ${payload.expires}. Contacta a tu proveedor para renovarla.`);
    }
    if (status.state === 'clock_rollback') {
      throw new Error('La fecha del equipo está atrasada. Corrige la fecha y hora antes de activar la licencia.');
    }
    fs.writeFileSync(
      this.licenseFile(),
      JSON.stringify({ key: key.trim(), activatedAt: now.toISOString() }, null, 2),
      'utf8',
    );
    if (resetsGuard) this.lastPersistMono = performance.now();
    await this.syncAnchors({ addId: payload.id, ...(resetsGuard ? { lastSeenAt: now.toISOString() } : {}) });
    return status;
  }

  /** Throws when charging must be blocked (trial over / license expired). */
  async assertCanSell(): Promise<void> {
    const status = await this.getStatus();
    if (status.blocked) {
      throw new Error(
        status.state === 'clock_rollback'
          ? 'La fecha del equipo está atrasada. Corrige la fecha y hora para seguir cobrando.'
          : status.state === 'expired'
            ? 'La licencia anual venció. Renueva tu licencia para seguir cobrando.'
            : 'El período de prueba terminó. Activa una licencia para seguir cobrando.',
      );
    }
  }
}

export const licenseService = new LicenseService();
