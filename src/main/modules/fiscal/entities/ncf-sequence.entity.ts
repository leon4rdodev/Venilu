import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm";

/**
 * Secuencias de e-NCF autorizadas por la DGII para el negocio.
 *
 * Estructura oficial del e-NCF (13 posiciones alfanuméricas): la letra `E` es
 * la serie, los dos dígitos siguientes identifican el tipo de e-CF y los
 * últimos diez corresponden al secuencial.
 *
 *   31 — Factura de Crédito Fiscal Electrónica
 *   32 — Factura de Consumo Electrónica
 *   34 — Nota de Crédito Electrónica
 *
 * p. ej. tipo 32 con next_number 143 → "E320000000143".
 */
@Entity("ncf_sequences")
@Index("idx_ncf_sequences_type", ["type"])
export class NcfSequence {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    type!: '31' | '32' | '34';

    /** Inicio del rango autorizado (inclusive): 10 dígitos secuenciales. */
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
