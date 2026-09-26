import { describe, it, expect, beforeAll } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import * as forge from 'node-forge';
import {
    cargarCertificadoP12,
    certificadoVigente,
    nifDelCertificado,
    verificarTitularCertificado,
    type CertificadoDigital,
} from './p12';
import {
    ALGORITMOS_DSIG,
    firmaUsaAlgoritmosDgii,
    firmarXml,
    extraerSignatureValue,
    verificarFirma,
} from './xmldsig';
import { codigoSeguridad, ESTRATEGIA_CODIGO_SEGURIDAD } from './security-code';
import { buildEcfXml, type BuildEcfInput } from '../xml/build-ecf';
import { validateEcf, validateSemilla, formatIssues } from '../xml/xsd-validator';

/* ------------------------------------------------------------------ */
/* Certificado de prueba generado en memoria (no hay fixtures en disco)*/
/* ------------------------------------------------------------------ */

const RNC_TITULAR = '131880738';

function crearP12(rncTitular: string, password: string): Buffer {
    // node genera el par de claves de forma nativa (rápida); node-forge solo
    // se usa aquí para empaquetarlo en PKCS#12, igual que hace la DGII.
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const priv = forge.pki.privateKeyFromPem(
        privateKey.export({ type: 'pkcs1', format: 'pem' }) as string
    );
    const pub = forge.pki.publicKeyFromPem(
        publicKey.export({ type: 'spki', format: 'pem' }) as string
    );

    const cert = forge.pki.createCertificate();
    cert.publicKey = pub;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date(Date.now() - 86_400_000);
    cert.validity.notAfter = new Date(Date.now() + 365 * 86_400_000);

    const sujetos = [
        { name: 'commonName', value: `Emisor ${rncTitular}` },
        // La DGII exige que el campo "SN" del certificado sea el RNC/cédula del
        // propietario. En X.500 eso es el atributo 2.5.4.5 `serialNumber`
        // (node-forge lo expone como `name: 'serialNumber'`).
        { name: 'serialNumber', value: rncTitular },
        { name: 'organizationName', value: 'VENILU SOFTWARE SRL' },
        { shortName: 'C', value: 'DO' },
    ];
    cert.setSubject(sujetos);
    cert.setIssuer(sujetos);
    cert.setExtensions([{ name: 'basicConstraints', cA: true }]);
    cert.sign(priv, forge.md.sha256.create());

    const asn1 = forge.pkcs12.toPkcs12Asn1(priv, [cert], password);
    return Buffer.from(forge.asn1.toDer(asn1).getBytes(), 'binary');
}

/* ------------------------------------------------------------------ */

function e31(): BuildEcfInput {
    return {
        tipo: 31,
        encf: 'E310000000001',
        fechaHoraFirma: '26-09-2026 10:30:00',
        encabezado: {
            IdDoc: {
                FechaVencimientoSecuencia: '31-10-2026',
                IndicadorMontoGravado: 1,
                TipoIngresos: '01',
                TipoPago: 1,
                TablaFormasPago: { FormaDePago: [{ FormaPago: 1, MontoPago: 200 }] },
            },
            Emisor: {
                RNCEmisor: RNC_TITULAR,
                RazonSocialEmisor: 'VENILU SOFTWARE SRL',
                DireccionEmisor: 'CALLE PRINCIPAL #123',
                FechaEmision: '26-09-2026',
            },
            Comprador: {
                RNCComprador: '131880739',
                RazonSocialComprador: 'CLIENTE EJEMPLO SRL',
            },
            Totales: {
                MontoGravadoTotal: 84.75,
                MontoGravadoI1: 84.75,
                MontoExento: 100,
                ITBIS1: 18,
                TotalITBIS: 15.25,
                TotalITBIS1: 15.25,
                MontoTotal: 200,
            },
        },
        detallesItems: {
            Item: [
                {
                    NumeroLinea: 1,
                    IndicadorFacturacion: 1,
                    NombreItem: 'PRODUCTO GRAVADO',
                    IndicadorBienoServicio: 1,
                    CantidadItem: 1,
                    PrecioUnitarioItem: 100,
                    MontoItem: 100,
                },
                {
                    NumeroLinea: 2,
                    IndicadorFacturacion: 4,
                    NombreItem: 'PRODUCTO EXENTO',
                    IndicadorBienoServicio: 1,
                    CantidadItem: 1,
                    PrecioUnitarioItem: 100,
                    MontoItem: 100,
                },
            ],
        },
    };
}

let cert: CertificadoDigital;

describe('certificado PKCS#12', () => {
    beforeAll(() => {
        cert = cargarCertificadoP12(crearP12(RNC_TITULAR, 'clave-secreta'), 'clave-secreta');
    });

    it('extrae clave privada, certificado, SN y huella', () => {
        expect(cert.privateKeyPem).toContain('PRIVATE KEY');
        expect(cert.certificatePem).toContain('CERTIFICATE');
        expect(cert.subjectSerialNumber).toBe(RNC_TITULAR);
        expect(cert.fingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
        expect(certificadoVigente(cert)).toBe(true);
    });

    it('la regla de la DGII: SN del certificado = RNC del propietario', () => {
        expect(nifDelCertificado(cert)).toBe(RNC_TITULAR);
        expect(verificarTitularCertificado(cert, RNC_TITULAR)).toBeNull();
        expect(verificarTitularCertificado(cert, '101000001')).toContain('SN');
    });

    it('rechaza la clave de acceso equivocada', () => {
        const p12 = crearP12(RNC_TITULAR, 'clave-secreta');
        expect(() => cargarCertificadoP12(p12, 'mala')).toThrow(/clave de acceso/i);
    });

    it('rechaza un archivo que no es PKCS#12', () => {
        expect(() => cargarCertificadoP12(Buffer.from('no soy un certificado'), 'x')).toThrow(
            /PKCS#12/
        );
    });
});

describe('firma digital XMLDSig — algoritmos exactos de la DGII', () => {
    let sinFirmar: string;
    let firmado: string;

    beforeAll(() => {
        sinFirmar = buildEcfXml(e31()).xml;
        firmado = firmarXml(sinFirmar, cert);
    });

    it('usa los algoritmos que exigen los ejemplos oficiales', () => {
        const { ok, detalles } = firmaUsaAlgoritmosDgii(firmado);
        expect(detalles, JSON.stringify(detalles, null, 2)).toEqual({
            canonicalizacion: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
            firma: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
            digest: 'http://www.w3.org/2001/04/xmlenc#sha256',
            transformacion: 'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
            uri: '',
        });
        expect(ok).toBe(true);
        expect(ALGORITMOS_DSIG.firma).toBe('http://www.w3.org/2001/04/xmldsig-more#rsa-sha256');
    });

    it('la estructura <Signature> es la de los cinco ejemplos oficiales', () => {
        // Espacio de nombres por defecto, SIN prefijo (igual que los ejemplos
        // .NET, VB.NET, Java y PHP de la DGII).
        expect(firmado).toContain('<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">');

        // Exactamente UNA transformación en <Transforms>: enveloped-signature.
        const transforms = firmado.match(/<Transform /g) ?? [];
        expect(transforms).toHaveLength(1);
        expect(firmado).toContain(
            '<Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/></Transforms>'
        );

        // KeyInfo con el certificado, como en los ejemplos oficiales.
        expect(firmado).toMatch(/<KeyInfo><X509Data><X509Certificate>[A-Za-z0-9+/=\s]+/);

        // Sin prefijo en SignedInfo/SignatureValue/DigestValue.
        expect(firmado).toContain('<SignedInfo>');
        expect(firmado).toContain('<SignatureValue>');
        expect(firmado).toContain('<DigestValue>');
    });

    it('NO inyecta un atributo Id en la raíz ECF (Reference URI vacía)', () => {
        expect(firmado.match(/<ECF[^>]*>/)?.[0]).toBe('<ECF>');
        expect(firmado).not.toMatch(/<ECF[^>]*\sId=/);
    });

    it('la <Signature> ocupa el slot que el XSD deja al final del ECF', () => {
        expect(firmado.endsWith('</ECF>')).toBe(true);
        const corte = firmado.indexOf('<Signature');
        expect(corte).toBeGreaterThan(firmado.indexOf('<FechaHoraFirma>'));
        expect(corte).toBeGreaterThan(firmado.indexOf('</FechaHoraFirma>'));
        // Y no hay nada entre </FechaHoraFirma> y <Signature>.
        expect(firmado.slice(firmado.indexOf('</FechaHoraFirma>') + '</FechaHoraFirma>'.length, corte)).toBe('');
    });

    it('la firma pasa la validación del XSD oficial de la DGII', () => {
        const result = validateEcf(firmado, 31);
        expect(result.issues, formatIssues(result)).toHaveLength(0);
    });

    it('la firma es válida (digest + SignedInfo)', () => {
        expect(verificarFirma(firmado)).toEqual({ ok: true });
    });

    it('alterar el XML firmado invalida la firma', () => {
        const alterado = firmado.replace('<MontoTotal>200</MontoTotal>', '<MontoTotal>999</MontoTotal>');
        expect(alterado).not.toBe(firmado);
        const r = verificarFirma(alterado);
        expect(r.ok).toBe(false);
        expect(r.error).toBeTruthy();
    });

    it('no permite firmar dos veces', () => {
        expect(() => firmarXml(firmado, cert)).toThrow(/ya contiene/i);
    });

    it('no introduce espacios de sangría (preserveWhitespace=false)', () => {
        // "Debe realizarse la firma sin la preservación de los espacios":
        // el builder no emite sangrías y la firma no añade ninguna.
        expect(firmado).not.toMatch(/>\s+</);
    });

    it('extrae SignatureValue/DigestValue en base64', () => {
        const sv = extraerSignatureValue(firmado);
        expect(sv).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
        expect(sv.length).toBeGreaterThan(100); // 2048 bits ≈ 344 caracteres
    });
});

describe('código de seguridad', () => {
    let firmado: string;

    beforeAll(() => {
        firmado = firmarXml(buildEcfXml(e31()).xml, cert);
    });

    it('tiene 6 caracteres, como dicen los documentos oficiales', () => {
        const codigo = codigoSeguridad(firmado);
        expect(codigo).toHaveLength(6);
        expect(codigo).toBe(extraerSignatureValue(firmado).slice(0, 6));
    });

    it('es estable: mismo XML firmado → mismo código', () => {
        expect(codigoSeguridad(firmado)).toBe(codigoSeguridad(firmado));
    });

    it('cambia si cambia la firma', () => {
        const otro = firmarXml(
            buildEcfXml({ ...e31(), encf: 'E310000000002' }).xml,
            cert
        );
        expect(codigoSeguridad(otro)).not.toBe(codigoSeguridad(firmado));
    });

    it('las estrategias alternativas son deterministas y distintas', () => {
        const a = codigoSeguridad(firmado, 'signature-value');
        const b = codigoSeguridad(firmado, 'sha256-base64');
        const c = codigoSeguridad(firmado, 'md5-hex');
        expect(a).toHaveLength(6);
        expect(b).toHaveLength(6);
        expect(c).toHaveLength(6);
        expect(new Set([a, b, c]).size).toBe(3);
        // Opción A es la que queda activa hasta que CertECF lo confirme.
        expect(ESTRATEGIA_CODIGO_SEGURIDAD).toBe('signature-value');
    });

    it('propaga el error si el XML no está firmado', () => {
        expect(() => codigoSeguridad(buildEcfXml(e31()).xml)).toThrow(/SignatureValue/);
    });
});

describe('firma de la semilla (autenticación)', () => {
    it('el XML de la semilla firmado cumple su XSD oficial', () => {
        // Tal como lo devuelve el servicio: <SemillaModel xmlns:xsi … xmlns:xsd …>
        const semilla =
            '<?xml version="1.0" encoding="UTF-8"?>' +
            '<SemillaModel xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"' +
            ' xmlns:xsd="http://www.w3.org/2001/XMLSchema">' +
            '<valor>0000000-0000-0000-0000-000000000000</valor>' +
            '<fecha>2026-09-26T10:30:00-04:00</fecha>' +
            '</SemillaModel>';

        const before = validateSemilla(semilla, { requireSignature: false });
        expect(before.issues, formatIssues(before)).toHaveLength(0);

        const firmado = firmarXml(semilla, cert);
        const after = validateSemilla(firmado);
        expect(after.issues, formatIssues(after)).toHaveLength(0);
        expect(verificarFirma(firmado)).toEqual({ ok: true });
        expect(firmaUsaAlgoritmosDgii(firmado).ok).toBe(true);
    });
});
