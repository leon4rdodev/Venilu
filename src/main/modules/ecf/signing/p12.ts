import * as forge from 'node-forge';

/**
 * Lectura del certificado digital en formato PKCS#12 (`.p12` / `.pfx`).
 *
 * Requisito oficial de la DGII (Descripción Técnica Emisores Electrónicos,
 * sección "Firmado de XML"; ver `docs/fec/REQUISITOS.md` §2):
 *
 *   "• El protocolo de firmado a utilizar es SHA-256.
 *    • El campo "SN" de los certificados digitales debe corresponder al RNC,
 *      Cedula o Pasaporte del propietario del certificado.
 *    • Debe realizarse la firma sin la preservación de los espacios
 *      preservewhitespace = false.
 *    • Una vez firmado el XML, este no puede ser alterado en ninguna
 *      circunstancia."
 *
 * `node-forge` es la librería que la DGII usa en su propio ejemplo oficial de
 * firmado ("Firmado de e-CF.pdf", sección "Método de firmado en TypeScript").
 */

export interface CertificadoDigital {
    /** Clave privada en PEM. */
    privateKeyPem: string;
    /** Certificado X.509 en PEM. */
    certificatePem: string;
    /** Valor del campo `SN` (`serialNumber` del Subject X.500), si existe. */
    subjectSerialNumber?: string;
    /** Common Name del Subject, respaldo para verificar el NIF. */
    subjectCommonName?: string;
    /** Número de serie del certificado (hex). */
    serialNumber: string;
    notBefore: Date;
    notAfter: Date;
    /** sha256 del certificado (hex), para mostrar qué certificado está en uso. */
    fingerprintSha256: string;
}

function buscarAtributo(attrs: forge.pki.CertificateField[], nombres: string[]): string | undefined {
    for (const attr of attrs) {
        const short = attr.shortName;
        const long = attr.name;
        if ((short && nombres.includes(short)) || (long && nombres.includes(long))) {
            const value = String(attr.value ?? '').trim();
            if (value) return value;
        }
    }
    return undefined;
}

/**
 * Carga un `.p12` y extrae clave privada + certificado.
 *
 * @param p12Bytes archivo `.p12` tal cual lo entregó la autoridad de certificación.
 * @param password clave de acceso del certificado.
 */
export function cargarCertificadoP12(p12Bytes: Buffer, password: string): CertificadoDigital {
    if (!p12Bytes?.length) {
        throw new Error('El archivo de certificado está vacío.');
    }

    let p12: forge.pkcs12.Pkcs12Pfx;
    try {
        const der = forge.util.createBuffer(p12Bytes.toString('binary'));
        const asn1 = forge.asn1.fromDer(der);
        p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/mac|password|password-based|integrity|PKCS#12/i.test(msg)) {
            throw new Error(
                'No se pudo abrir el certificado: la clave de acceso es incorrecta o el archivo está dañado.'
            );
        }
        throw new Error(`El archivo no es un certificado PKCS#12 válido: ${msg}`);
    }

    // Se recorren los safeBags directamente: `getBags()` filtra por OID y
    // node-forge no registra `pkcs8ShroudedKeybag` en su tabla de OIDs, así
    // que esa consulta devolvería siempre vacía.
    const safeBags: forge.pkcs12.Bag[] = p12.safeContents.flatMap((c) => c.safeBags);
    const cert = safeBags.find((b) => Boolean(b.cert))?.cert;
    if (!cert) {
        throw new Error('El archivo no contiene un certificado X.509.');
    }
    const key = safeBags.find((b) => Boolean(b.key))?.key;
    if (!key) {
        throw new Error('El archivo no contiene la clave privada asociada al certificado.');
    }

    const derCert = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();

    return {
        privateKeyPem: forge.pki.privateKeyToPem(key),
        certificatePem: forge.pki.certificateToPem(cert),
        subjectSerialNumber: buscarAtributo(cert.subject.attributes, ['SN', 'serialNumber']),
        subjectCommonName: buscarAtributo(cert.subject.attributes, ['CN', 'commonName']),
        serialNumber: String(cert.serialNumber ?? ''),
        notBefore: cert.validity.notBefore,
        notAfter: cert.validity.notAfter,
        fingerprintSha256: forge.md.sha256.create().update(derCert).digest().toHex(),
    };
}

/** Deja solo dígitos para comparar RNC/cédula con el `SN` del certificado. */
function soloDigitos(value: string): string {
    return String(value).replace(/\D/g, '');
}

/**
 * Identificador fiscal que el certificado declara como titular: `SN` si existe
 * (lo que exige la DGII), o `CN` en su defecto.
 */
export function nifDelCertificado(cert: CertificadoDigital): string | undefined {
    const sn = cert.subjectSerialNumber;
    if (sn && soloDigitos(sn).length >= 9) return sn;
    const cn = cert.subjectCommonName;
    if (cn && soloDigitos(cn).length >= 9) return cn;
    return sn ?? cn;
}

/**
 * Comprueba la regla de la DGII: el campo `SN` del certificado debe
 * corresponder al RNC, Cédula o Pasaporte del propietario.
 *
 * Devuelve `null` si todo está bien, o el motivo del problema.
 */
export function verificarTitularCertificado(
    cert: CertificadoDigital,
    nifTitular: string
): string | null {
    const esperado = soloDigitos(nifTitular);
    if (!esperado) return null; // Sin NIF con qué comparar: no se puede verificar.

    const declarado = nifDelCertificado(cert);
    const regla =
        'La DGII exige que el campo "SN" del certificado corresponda al RNC, ' +
        'Cédula o Pasaporte del propietario.';
    if (!declarado) {
        return `El certificado no declara un NIF en los campos SN/CN. ${regla}`;
    }
    if (soloDigitos(declarado) !== esperado) {
        return `El certificado pertenece a ${declarado} pero la emisión es a nombre de ${nifTitular}. ${regla}`;
    }
    return null;
}

/** ¿El certificado está vigente? (con 5 minutos de margen). */
export function certificadoVigente(cert: CertificadoDigital, ahora = new Date()): boolean {
    const margenMs = 5 * 60_000;
    return (
        ahora.getTime() + margenMs >= cert.notBefore.getTime() &&
        ahora.getTime() - margenMs <= cert.notAfter.getTime()
    );
}
