/**
 * Certificado .p12 de prueba generado en memoria (mismo método que
 * `signing/xmldsig.test.ts`): el SN del sujeto es el RNC del titular, como
 * exige la DGII.
 */
import { generateKeyPairSync } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as forge from 'node-forge';

export function crearP12(rncTitular: string, password: string): Buffer {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const priv = forge.pki.privateKeyFromPem(privateKey.export({ type: 'pkcs1', format: 'pem' }) as string);
  const pub = forge.pki.publicKeyFromPem(publicKey.export({ type: 'spki', format: 'pem' }) as string);

  const cert = forge.pki.createCertificate();
  cert.publicKey = pub;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 365 * 86_400_000);
  const sujeto = [
    { name: 'commonName', value: `Emisor ${rncTitular}` },
    { name: 'serialNumber', value: rncTitular },
    { shortName: 'C', value: 'DO' },
  ];
  cert.setSubject(sujeto);
  cert.setIssuer(sujeto);
  cert.sign(priv, forge.md.sha256.create());

  const asn1 = forge.pkcs12.toPkcs12Asn1(priv, [cert], password);
  return Buffer.from(forge.asn1.toDer(asn1).getBytes(), 'binary');
}

/** Escribe el .p12 en un directorio temporal y devuelve su ruta. */
export function escribirP12(rncTitular: string, password: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'venilu-p12-'));
  const ruta = path.join(dir, 'cert.p12');
  fs.writeFileSync(ruta, crearP12(rncTitular, password));
  return ruta;
}
