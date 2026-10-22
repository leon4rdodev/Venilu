/**
 * Tipos de comprobante fiscal electrónico (e-CF) y sus etiquetas.
 *
 * Mapeo oficial — XSD `TipoeCFType` de la DGII (comentario literal de cada
 * enumeración), `src/main/modules/ecf/schemas/ecf-3X.xsd`:
 *
 *   31 → "Factura de Crédito Fiscal Electrónica"   (ex-B01)
 *   32 → "Factura de Consumo Electrónica"          (ex-B02)
 *   34 → "Nota de Crédito Electrónica"             (ex-B04)
 *
 * Los códigos B01/B02/B04 se aceptan en las etiquetas únicamente para poder
 * leer ventas antiguas guardadas; la facturación en papel fue retirada.
 */

/** Código de comprobante que puede aparecer en una venta. */
export type NcfTipo = '31' | '32' | '34' | 'B01' | 'B02' | 'B04';

/** Código que Venilu EMITE (el resto son solo históricos). */
export type NcfTipoElectronico = '31' | '32' | '34';

interface NcfInfo {
    /** Nombre corto, para botones y filtros. */
    corto: string;
    /** Nombre completo, para encabezados de comprobante. */
    completo: string;
}

const INFO: Record<NcfTipo, NcfInfo> = {
    '31': { corto: 'Crédito Fiscal (31)', completo: 'FACTURA DE CRÉDITO FISCAL' },
    '32': { corto: 'Consumo (32)', completo: 'FACTURA DE CONSUMO' },
    '34': { corto: 'Nota de Crédito (34)', completo: 'NOTA DE CRÉDITO' },
    B01: { corto: 'Crédito Fiscal (B01)', completo: 'FACTURA DE CRÉDITO FISCAL' },
    B02: { corto: 'Consumo (B02)', completo: 'FACTURA DE CONSUMO' },
    B04: { corto: 'Nota de Crédito (B04)', completo: 'NOTA DE CRÉDITO' },
};

const DESCONOCIDO: NcfInfo = { corto: 'Comprobante fiscal', completo: 'COMPROBANTE FISCAL' };

function info(tipo: string | null | undefined): NcfInfo {
    return (INFO[tipo as NcfTipo] ?? DESCONOCIDO);
}

/** "Crédito Fiscal (31)" — etiqueta corta para botones, filtros y toasts. */
export function ncfCorto(tipo: string | null | undefined): string {
    return info(tipo).corto;
}

/** "FACTURA DE CRÉDITO FISCAL" — encabezado impreso del comprobante. */
export function ncfCompleto(tipo: string | null | undefined): string {
    return info(tipo).completo;
}

/** Tipo e-CF de una venta ya emitida; `null` si no llevó comprobante. */
export function esElectronico(tipo: string | null | undefined): boolean {
    return tipo === '31' || tipo === '32' || tipo === '34';
}
