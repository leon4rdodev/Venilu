/**
 * Tipos del contrato IPC e-CF (espejo de `main/modules/ecf`).
 *
 * Cada fila es un comprobante fiscal electrónico con su e-NCF (13 posiciones:
 * `E` + 2 dígitos de tipo + 10 secuenciales) y su estado en el ciclo de vida
 * ante la DGII.
 */

/** Tipos de e-CF que emite Venilu (XSD `TipoeCFType` de la DGII). */
export type TipoEcf = 31 | 32 | 34;

/**
 * Estados del ciclo:
 *
 * - `draft`    — e-NCF asignado, XML pendiente de construir y firmar.
 * - `signed`   — XML validado contra el XSD oficial y firmado.
 * - `queued`   — en cola para transmitir (pendiente de red/reintento).
 * - `sent`     — transmitido, con `track_id` de la DGII.
 * - `accepted` — aceptado (1) o aceptado condicional (4).
 * - `rejected` — rechazado (2): `dgii_mensajes` trae el detalle.
 */
export type EstadoEcf = 'draft' | 'signed' | 'queued' | 'sent' | 'accepted' | 'rejected';

export interface EcfDocument {
  id: string;
  sale_id: string | null;
  tipo: TipoEcf;
  encf: string;
  via: 'ecf' | 'rfce';
  estado: EstadoEcf;
  rnc_emisor: string | null;
  rnc_comprador: string | null;
  nombre_comprador: string | null;
  monto_total: number;
  itbis_total: number;
  fecha_emision: string | null;
  codigo_seguridad: string | null;
  track_id: string | null;
  dgii_code: number | null;
  dgii_estado: string | null;
  dgii_mensajes: string | null;
  last_error: string | null;
  intentos: number;
  sent_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EcfStats {
  total: number;
  draft: number;
  signed: number;
  queued: number;
  sent: number;
  accepted: number;
  rejected: number;
}

/** Resumen de una pasada de emisión (`ecf:emit-pending`). */
export interface ResumenEmision {
  emitidos: number;
  enviados: number;
  consultados: number;
  fallos: number;
}

/** Etiqueta corta de cada estado, para chips, filtros y toasts. */
export const ESTADO_ECF: Record<EstadoEcf, { label: string; tone: string }> = {
  draft:    { label: 'Pendiente de firma', tone: 'bg-muted text-muted-foreground' },
  signed:   { label: 'Firmado',            tone: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  queued:   { label: 'En cola',            tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  sent:     { label: 'Enviado a la DGII',  tone: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  accepted: { label: 'Aceptado',           tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  rejected: { label: 'Rechazado',          tone: 'bg-red-500/10 text-red-600 dark:text-red-400' },
};

/** Códigos de validación publicados por la DGII (§4.5 de REQUISITOS.md). */
export const CODIGO_DGII: Record<number, string> = {
  0: 'No encontrado',
  1: 'Aceptado',
  2: 'Rechazado',
  3: 'En proceso',
  4: 'Aceptado condicional',
};

/** Nombre del servicio por el que va el comprobante. */
export const VIA_ECF: Record<'ecf' | 'rfce', string> = {
  ecf: 'Recepción de e-CF',
  rfce: 'Resumen de Factura de Consumo',
};
