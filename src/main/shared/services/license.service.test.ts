import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifyLicenseKey, computeStatus, TRIAL_DAYS, LicensePayload } from './license.service';

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
