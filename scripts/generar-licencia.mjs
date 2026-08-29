#!/usr/bin/env node
/**
 * Generador de licencias de Venilu (SOLO para el vendedor).
 *
 * Requiere la clave privada en ~/.venilu-licencias/private.pem — esa clave
 * NUNCA debe entrar al repositorio ni compartirse. Sin ella no se pueden
 * emitir licencias válidas (la app solo verifica con la clave pública).
 *
 * Uso:
 *   node scripts/generar-licencia.mjs --cliente "Juan Pérez" --tipo perpetua
 *   node scripts/generar-licencia.mjs --cliente "Colmado Doña Ana" --tipo anual
 *   node scripts/generar-licencia.mjs --cliente "X" --tipo anual --vence 2027-12-31
 *   node scripts/generar-licencia.mjs --cliente "X" --tipo anual --negocio "Colmado Ana"
 *
 * La licencia anual vence por defecto a 1 año exacto desde hoy.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const cliente = getArg('cliente');
const tipo = getArg('tipo');
const negocio = getArg('negocio');
let vence = getArg('vence');

if (!cliente || !['perpetua', 'anual'].includes(tipo ?? '')) {
  console.error('Uso: node scripts/generar-licencia.mjs --cliente "Nombre" --tipo perpetua|anual [--vence YYYY-MM-DD] [--negocio "Nombre del negocio"]');
  process.exit(1);
}

if (tipo === 'anual' && !vence) {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  vence = d.toISOString().slice(0, 10);
}
if (tipo === 'anual' && !/^\d{4}-\d{2}-\d{2}$/.test(vence)) {
  console.error('La fecha de vencimiento debe tener formato YYYY-MM-DD');
  process.exit(1);
}

const privPath = path.join(os.homedir(), '.venilu-licencias', 'private.pem');
if (!fs.existsSync(privPath)) {
  console.error(`No se encontró la clave privada en ${privPath}`);
  console.error('Genera el par de claves una sola vez y guárdalo con copia de seguridad segura.');
  process.exit(1);
}
const privateKey = fs.readFileSync(privPath, 'utf8');

const payload = {
  id: crypto.randomUUID().slice(0, 8).toUpperCase(),
  customer: cliente,
  ...(negocio ? { business: negocio } : {}),
  type: tipo,
  issued: new Date().toISOString().slice(0, 10),
  ...(tipo === 'anual' ? { expires: vence } : {}),
};

const payloadRaw = Buffer.from(JSON.stringify(payload), 'utf8');
const signature = crypto.sign(null, payloadRaw, privateKey);
const key = `VNL-${payloadRaw.toString('base64url')}.${signature.toString('base64url')}`;

console.log('════════════════════════════════════════════════════════════');
console.log('  LICENCIA VENILU GENERADA');
console.log('════════════════════════════════════════════════════════════');
console.log(`  Cliente:  ${payload.customer}`);
if (payload.business) console.log(`  Negocio:  ${payload.business}`);
console.log(`  Tipo:     ${payload.type === 'perpetua' ? 'Perpetua (pago único)' : `Anual (vence ${payload.expires})`}`);
console.log(`  ID:       ${payload.id}`);
console.log('────────────────────────────────────────────────────────────');
console.log('  Clave (copiar completa y enviar al cliente):');
console.log('');
console.log(key);
console.log('');
console.log('════════════════════════════════════════════════════════════');

// Registro local de licencias emitidas (fuera del repo)
const logPath = path.join(os.homedir(), '.venilu-licencias', 'emitidas.jsonl');
fs.appendFileSync(logPath, JSON.stringify({ ...payload, key, generated_at: new Date().toISOString() }) + '\n');
console.log(`Registrada en ${logPath}`);
