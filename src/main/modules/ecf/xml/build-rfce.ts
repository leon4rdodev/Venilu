import { getParsedSchema, getRootNode } from './xsd-model';
import { serializeRoot, type RawNode } from './render';

/**
 * **RFCE** — Resumen de Factura de Consumo Electrónica (XSD `rfce-32.xsd`).
 *
 * > "Los contribuyentes que emitan facturas de consumo electrónicas menores a
 * > DOP$250 mil mediante el Formato de e-CF, deberán enviar a Impuestos
 * > Internos las ventas realizadas mediante este tipo de e-CF, en el formato
 * > XML que se establece en este documento."
 * >  — Formato RFCE v1.0, DGII, `docs/fec/FUENTES.md` [RFCE].
 *
 * Estructura del XSD oficial:
 *
 *   <RFCE>
 *     <Encabezado>
 *       <Version>…</Version>
 *       <IdDoc>…</IdDoc>
 *       <Emisor>RNCEmisor/RazonSocialEmisor/FechaEmision</Emisor>
 *       <Comprador>…</Comprador>
 *       <Totales>…</Totales>
 *       <CodigoSeguridadeCF>…</CodigoSeguridadeCF>   (6, obligatorio)
 *     </Encabezado>
 *     <!-- slot xs:any de la firma -->
 *   </RFCE>
 *
 * No hay `<FechaHoraFirma>` ni `<DetallesItems>`: es un **resumen**. El
 * detalle completo vive en el e-CF extendido (E32) que se conserva localmente.
 */
export interface BuildRfceInput {
    /** e-NCF del e-CF original (13 caracteres). */
    encf: string;
    /** Contenido de <IdDoc> SIN TipoeCF/eNCF, que se inyectan solos. */
    idDoc: RawNode;
    /** Contenido de <Emisor> SIN FechaEmision/…: ver sección. */
    emisor: RawNode;
    /** Contenido de <Comprador> (puede venir vacío: RNCComprador/RazonSocial). */
    comprador: RawNode;
    /** Contenido de <Totales> (MontoGravadoTotal … MontoTotal). */
    totales: RawNode;
    /**
     * Primeros 6 caracteres del `SignatureValue` del **e-CF original**
     * (`<CodigoSeguridadeCF>`, campo 31 del RFCE).
     */
    codigoSeguridad: string;
}

export interface BuildRfceResult {
    /** XML completo con declaración `<?xml ?>`, todavía SIN firmar. */
    xml: string;
    descartados: string[];
}

export function buildRfceXml(input: BuildRfceInput): BuildRfceResult {
    const schema = getParsedSchema('rfce-32');
    const root = getRootNode(schema);

    if (root.name !== 'RFCE') {
        throw new Error(`El XSD RFCE tiene raíz "${root.name}", se esperaba "RFCE"`);
    }

    const raw: RawNode = {
        Encabezado: {
            Version: '1.0',
            IdDoc: {
                TipoeCF: 32,
                eNCF: input.encf,
                ...input.idDoc,
            },
            Emisor: input.emisor,
            Comprador: input.comprador,
            Totales: input.totales,
            CodigoSeguridadeCF: input.codigoSeguridad,
        },
    };

    return serializeRoot(root, raw);
}
