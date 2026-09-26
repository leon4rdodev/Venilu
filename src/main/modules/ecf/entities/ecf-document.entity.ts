import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from "typeorm";

/**
 * Comprobante fiscal electrónico (e-CF) emitido por Venilu.
 *
 * Cada fila es UN e-CF: su e-NCF, el estado de su ciclo de vida y, cuando ya
 * se firmó, el XML exacto que se envió a la DGII.
 *
 * Estados del ciclo (transiciones implementadas en `services/ecf.service.ts`):
 *
 *   draft    — asignado el e-NCF en la venta, todavía sin XML firmado.
 *   signed   — XML construido, validado contra el XSD oficial y firmado.
 *   queued   — en cola para enviar (pendiente de red/reintento).
 *   sent     — enviado, con `track_id` de la DGII.
 *   accepted — la DGII lo validó (aceptado o aceptado condicional).
 *   rejected — la DGII lo rechazó: `dgii_mensajes` trae el detalle.
 *
 * Estados DGII (`docs/fec/REQUISITOS.md` §4.5): 0 No encontrado ·
 * 1 Aceptado · 2 Rechazado · 3 En proceso · 4 Aceptado condicional.
 */
@Entity("ecf_documents")
@Index("idx_ecf_documents_estado", ["estado"])
@Index("idx_ecf_documents_sale", ["sale_id"])
export class EcfDocument {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    /** Venta origen del comprobante (una venta → un e-CF; una anulación → NC). */
    @Column({ nullable: true })
    sale_id?: string;

    /** Tipo de e-CF: 31 Crédito Fiscal · 32 Consumo · 34 Nota de Crédito. */
    @Column("integer")
    tipo!: 31 | 32 | 34;

    /** e-NCF: `E` + 2 dígitos de tipo + 10 secuenciales = 13 posiciones. */
    @Column({ unique: true, length: 13 })
    encf!: string;

    /**
     * Servicio por el que va a la DGII:
     * `ecf` → recepción de e-CF · `rfce` → resumen de Factura de Consumo
     * < RD$250,000 (XSD RFCE, un comprobante por archivo).
     */
    @Column({ default: "ecf" })
    via!: "ecf" | "rfce";

    @Column({ default: "draft" })
    estado!: "draft" | "signed" | "queued" | "sent" | "accepted" | "rejected";

    @Column({ length: 11, nullable: true })
    rnc_emisor?: string;

    @Column({ length: 11, nullable: true })
    rnc_comprador?: string;

    @Column({ nullable: true })
    nombre_comprador?: string;

    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    monto_total!: number;

    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    itbis_total!: number;

    /** `dd-MM-yyyy` — la misma literal que viaja en `<FechaEmision>`. */
    @Column({ length: 10, nullable: true })
    fecha_emision?: string;

    /** Primeros 6 caracteres del `SignatureValue` (código de seguridad QR). */
    @Column({ length: 6, nullable: true })
    codigo_seguridad?: string;

    /** XML final, ya firmado. Es lo que se envía y se conserva como respaldo. */
    @Column({ type: "text", nullable: true })
    signed_xml?: string;

    @Column({ nullable: true })
    track_id?: string;

    /** Código de validación DGII (0-4), null mientras no responda. */
    @Column({ type: "integer", nullable: true })
    dgii_code?: number;

    @Column({ nullable: true })
    dgii_estado?: string;

    @Column({ type: "text", nullable: true })
    dgii_mensajes?: string;

    /** Último error local o de red (firma, XSD, envío). */
    @Column({ type: "text", nullable: true })
    last_error?: string;

    @Column({ default: 0 })
    intentos!: number;

    /** Cuándo reintentar el envío (backoff exponencial). */
    @Column({ type: "datetime", nullable: true })
    proximo_intento?: Date | null;

    @Column({ type: "datetime", nullable: true })
    sent_at?: Date | null;

    @Column({ type: "datetime", nullable: true })
    resolved_at?: Date | null;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;
}
