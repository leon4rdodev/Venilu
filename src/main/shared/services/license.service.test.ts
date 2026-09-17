import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  verifyLicenseKey, computeStatus, TRIAL_DAYS, LicensePayload,
  advanceHighWater, earliestIso, latestIso, CLOCK_TOLERANCE_MS,
} from './license.service';
import { readAnchor, writeAnchor } from './license-anchor';

// Test keypair — the production public key is different, so keys signed here
// can never activate a real install (and vice versa).
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const TEST_PUB = publicKey.export({ type: 'spki', format: 'pem' }).toString();

function makeKey(payload: Partial<LicensePayload>, tamper = false): string {
  const full = { id: 'TEST1234', customer: 'Cliente Prueba', issued: '2026-08-26', type: 'perpetua', ...payload };
  const raw = Buffer.from(JSON.stringify(full), 'utf8');
  const sig = crypto.sign(null, raw, privateKey);
  const body = tamper
    ? Buffer.from(JSON.stringify({ ...full, customer: 'Hacker' }), 'utf8')
    : raw;
  return `VNL-${body.toString('base64url')}.${sig.toString('base64url')}`;
}

describe('Licencias — verificación de clave', () => {
  it('acepta una licencia perpetua bien firmada', () => {
    const payload = verifyLicenseKey(makeKey({ type: 'perpetua' }), TEST_PUB);
    expect(payload.customer).toBe('Cliente Prueba');
    expect(payload.type).toBe('perpetua');
  });

  it('acepta una licencia anual con vencimiento', () => {
    const payload = verifyLicenseKey(makeKey({ type: 'anual', expires: '2027-08-26' }), TEST_PUB);
    expect(payload.expires).toBe('2027-08-26');
  });

  it('rechaza una clave con el payload alterado (firma inválida)', () => {
    expect(() => verifyLicenseKey(makeKey({}, true), TEST_PUB)).toThrow(/firma/i);
  });

  it('rechaza una clave firmada con OTRA clave privada (la de producción no es esta)', () => {
    // Verificar contra la clave pública REAL embebida: la firma de prueba no vale
    expect(() => verifyLicenseKey(makeKey({}))).toThrow(/firma/i);
  });

  it('rechaza formatos rotos', () => {
    expect(() => verifyLicenseKey('', TEST_PUB)).toThrow(/inválido/i);
    expect(() => verifyLicenseKey('ABC-123', TEST_PUB)).toThrow(/inválido/i);
    expect(() => verifyLicenseKey('VNL-noesbase64', TEST_PUB)).toThrow();
    expect(() => verifyLicenseKey('VNL-aGVsbG8.####', TEST_PUB)).toThrow();
  });

  it('rechaza una anual sin fecha de vencimiento', () => {
    expect(() => verifyLicenseKey(makeKey({ type: 'anual', expires: undefined }), TEST_PUB)).toThrow(/vencimiento/i);
  });
});

describe('Licencias — estado', () => {
  const NOW = new Date('2026-08-26T12:00:00');
  const lic = (over: Partial<LicensePayload>): LicensePayload => ({
    id: 'X', customer: 'C', issued: '2026-08-26', type: 'perpetua', ...over,
  });

  it('perpetua activa siempre', () => {
    const s = computeStatus(lic({ type: 'perpetua' }), null, NOW);
    expect(s.state).toBe('active');
    expect(s.blocked).toBe(false);
  });

  it('anual vigente: activa con días restantes', () => {
    const s = computeStatus(lic({ type: 'anual', expires: '2026-09-26' }), null, NOW);
    expect(s.state).toBe('active');
    // Aug 26 noon → Sep 26 END of day = 31.5 días → ceil 32
    expect(s.daysToExpiry).toBe(32);
  });

  it('anual vencida: bloqueada', () => {
    const s = computeStatus(lic({ type: 'anual', expires: '2026-08-25' }), null, NOW);
    expect(s.state).toBe('expired');
    expect(s.blocked).toBe(true);
  });

  it('la anual vence al FINAL del día de vencimiento', () => {
    const s = computeStatus(lic({ type: 'anual', expires: '2026-08-26' }), null, NOW);
    expect(s.state).toBe('active');
  });

  it('sin licencia: prueba de 15 días con cuenta regresiva', () => {
    const started = new Date(NOW.getTime() - 5 * 86_400_000).toISOString();
    const s = computeStatus(null, started, NOW);
    expect(s.state).toBe('trial');
    expect(s.trialDaysLeft).toBe(TRIAL_DAYS - 5);
    expect(s.blocked).toBe(false);
  });

  it('prueba vencida: bloqueada', () => {
    const started = new Date(NOW.getTime() - (TRIAL_DAYS + 1) * 86_400_000).toISOString();
    const s = computeStatus(null, started, NOW);
    expect(s.state).toBe('trial_expired');
    expect(s.blocked).toBe(true);
    expect(s.trialDaysLeft).toBe(0);
  });

  it('sin ancla de prueba: arranca la prueba ahora (día 0)', () => {
    const s = computeStatus(null, null, NOW);
    expect(s.state).toBe('trial');
    expect(s.trialDaysLeft).toBe(TRIAL_DAYS);
  });
});

describe('Licencias — guarda de reloj', () => {
  const NOW = new Date('2026-08-26T12:00:00');
  const annual: LicensePayload = { id: 'X', customer: 'C', issued: '2026-01-01', type: 'anual', expires: '2026-09-26' };
  const daysAhead = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

  it('reloj atrasado más allá de la tolerancia: bloquea prueba y anual', () => {
    expect(computeStatus(null, null, NOW, daysAhead(10))).toMatchObject({ state: 'clock_rollback', blocked: true });
    expect(computeStatus(annual, null, NOW, daysAhead(10))).toMatchObject({ state: 'clock_rollback', blocked: true });
  });

  it('la perpetua nunca se bloquea por el reloj', () => {
    const s = computeStatus({ ...annual, type: 'perpetua', expires: undefined }, null, NOW, daysAhead(400));
    expect(s).toMatchObject({ state: 'active', blocked: false });
  });

  it('dentro de la tolerancia no bloquea, pero el tiempo no retrocede', () => {
    const lastSeen = new Date(NOW.getTime() + CLOCK_TOLERANCE_MS / 2).toISOString();
    // La anual venció según la marca, aunque el reloj del sistema diga que no
    const s = computeStatus({ ...annual, expires: '2026-08-26' }, null, NOW, lastSeen);
    expect(s.state).toBe('expired');
  });

  it('una marca en el pasado no cambia nada', () => {
    const s = computeStatus(annual, null, NOW, daysAhead(-3));
    expect(s).toMatchObject({ state: 'active', daysToExpiry: 32 });
  });

  it('la marca sigue el reloj y nunca avanza menos que el tiempo de uso', () => {
    expect(advanceHighWater(null, NOW, 0)).toBe(NOW.toISOString());
    expect(advanceHighWater(daysAhead(-1), NOW, 5_000)).toBe(NOW.toISOString());
    // Reloj atrasado: la marca avanza igual por el tiempo que la app estuvo abierta
    const ahead = daysAhead(5);
    expect(Date.parse(advanceHighWater(ahead, NOW, 60_000))).toBe(Date.parse(ahead) + 60_000);
  });

  it('reconciliación: gana el inicio de prueba más antiguo y la marca más reciente', () => {
    expect(earliestIso(daysAhead(-10), daysAhead(-2))).toBe(daysAhead(-10));
    expect(earliestIso(null, daysAhead(-2))).toBe(daysAhead(-2));
    expect(earliestIso('basura', null)).toBeNull();
    expect(latestIso(daysAhead(-10), daysAhead(-2))).toBe(daysAhead(-2));
    expect(latestIso(daysAhead(1), undefined)).toBe(daysAhead(1));
  });
});

describe('Licencias — ancla redundante', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vnl-anchor-')), 'nested', 'anchor.dat');
  const anchor = { trialStartedAt: '2026-08-01T10:00:00.000Z', lastSeenAt: '2026-08-26T12:00:00.000Z', seenIds: ['AB12CD34'] };

  it('no existe: null', () => {
    expect(readAnchor(file)).toBeNull();
  });

  it('escribe (creando la carpeta) y lee de vuelta', () => {
    expect(writeAnchor(anchor, file)).toBe(true);
    expect(readAnchor(file)).toEqual(anchor);
  });

  it('editada a mano: se descarta', () => {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    raw.body = raw.body.replace('2026-08-01', '2027-08-01');
    fs.writeFileSync(file, JSON.stringify(raw));
    expect(readAnchor(file)).toBeNull();
  });

  it('corrupta: se descarta', () => {
    fs.writeFileSync(file, 'no es json');
    expect(readAnchor(file)).toBeNull();
  });
});
