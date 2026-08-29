import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm";

/**
 * Secuencias de NCF autorizadas por la DGII para el negocio.
 * Formato del comprobante emitido: <tipo><secuencia de 8 dígitos>
 * p. ej. B02 con next_number 143 → "B0200000143".
 *
 *   B01 — Factura de Crédito Fiscal (cliente con RNC)
 *   B02 — Factura de Consumo (consumidor final)
 *   B04 — Nota de Crédito (anulaciones de ventas con NCF)
 */
@Entity("ncf_sequences")
@Index("idx_ncf_sequences_type", ["type"])
export class NcfSequence {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    type!: 'B01' | 'B02' | 'B04';

    /** Inicio del rango autorizado (inclusive). */
    @Column("integer")
    from_number!: number;

    /** Fin del rango autorizado (inclusive). */
    @Column("integer")
    to_number!: number;

    /** Próximo número a emitir. Agotada cuando next_number > to_number. */
    @Column("integer")
    next_number!: number;

    /** Fecha de vencimiento de la autorización (YYYY-MM-DD). */
    @Column({ nullable: true })
    expires_at?: string;

    @Column({ default: true })
    active!: boolean;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;
}
