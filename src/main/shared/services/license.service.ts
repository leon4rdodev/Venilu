import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { AppDataSource } from '@main/config/data-source';
import { Setting } from '@main/modules/settings/entities/setting.entity';

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
 */
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAhCkozB2R3/k5RgYYBWs+s2DAWhawNQJpGd9tPSd/HXA=
-----END PUBLIC KEY-----`;

export const TRIAL_DAYS = 15;

export interface LicensePayload {
  id: string;
  customer: string;
  business?: string;
  type: 'perpetua' | 'anual';
  issued: string;
  expires?: string;
}

export interface LicenseStatus {
  state: 'trial' | 'active' | 'expired' | 'trial_expired';
  /** Sales blocked? (expired annual / trial over, with no valid key) */
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

/** Pure status derivation — unit-testable with an injected clock. */
export function computeStatus(
  license: LicensePayload | null,
  trialStartedAt: string | null,
  now: Date = new Date(),
): LicenseStatus {
  if (license) {
    if (license.type === 'perpetua') {
      return { state: 'active', blocked: false, license };
    }
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
  private licenseFile(): string {
    return path.join(app.getPath('userData'), 'license.json');
  }

  private readStoredKey(): string | null {
    try {
      const raw = JSON.parse(fs.readFileSync(this.licenseFile(), 'utf8'));
      return typeof raw?.key === 'string' ? raw.key : null;
    } catch {
      return null;
    }
  }

  /**
   * Trial anchor lives in the DATABASE (settings row), so deleting a file
   * doesn't reset it; the license key itself lives in userData/license.json.
   */
  private async getTrialStartedAt(): Promise<string | null> {
    const settings = await AppDataSource.getRepository(Setting).findOneBy({ id: 1 });
    return settings?.trial_started_at ?? null;
  }

  /** Called once at boot: anchors the trial start on first run. */
  async ensureTrialStarted(): Promise<void> {
    const repo = AppDataSource.getRepository(Setting);
    let settings = await repo.findOneBy({ id: 1 });
    if (!settings) {
      settings = repo.create({ id: 1, business_name: 'Venilu', paper_size: '80mm' });
    }
    if (!settings.trial_started_at) {
      settings.trial_started_at = new Date().toISOString();
      await repo.save(settings);
    }
  }

  async getStatus(): Promise<LicenseStatus> {
    const key = this.readStoredKey();
    let license: LicensePayload | null = null;
    if (key) {
      try {
        license = verifyLicenseKey(key);
      } catch {
        license = null; // tampered/corrupt stored key → back to trial rules
      }
    }
    const trialStartedAt = await this.getTrialStartedAt();
    return computeStatus(license, trialStartedAt);
  }

  /** Validates and persists a key. Throws (in Spanish) when it's not usable. */
  async activate(key: string): Promise<LicenseStatus> {
    const payload = verifyLicenseKey(key);
    const status = computeStatus(payload, null);
    if (status.state === 'expired') {
      throw new Error(`Esta licencia venció el ${payload.expires}. Contacta a tu proveedor para renovarla.`);
    }
    fs.writeFileSync(
      this.licenseFile(),
      JSON.stringify({ key: key.trim(), activatedAt: new Date().toISOString() }, null, 2),
      'utf8',
    );
    return status;
  }

  /** Throws when charging must be blocked (trial over / license expired). */
  async assertCanSell(): Promise<void> {
    const status = await this.getStatus();
    if (status.blocked) {
      throw new Error(
        status.state === 'expired'
          ? 'La licencia anual venció. Renueva tu licencia para seguir cobrando.'
          : 'El período de prueba terminó. Activa una licencia para seguir cobrando.',
      );
    }
  }
}

export const licenseService = new LicenseService();
