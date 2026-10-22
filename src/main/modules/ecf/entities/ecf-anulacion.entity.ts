import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from "typeorm";

/**
 * Solicitud de **anulación de e-NCF no utilizados** (formato ANECF) enviada a
 * la DGII.
 *
 * Fuente: *Descripción Técnica Servicios DGII* → "Anulación de e-NCF":
 * "Servicio web responsable de recibir y anular los rangos de secuencias no
 * utilizados (e-NCF)…". Ver `docs/fec/REQUISITOS.md` §4.20.
 *
 * Estados:
 *   pendiente — registrada; el rango ya no se usa localmente.
 *   aceptada  — la DGII confirmó la anulación.
 *   parcial   — la DGII anuló el rango "con excepción de las secuencias del
 *               detalle" (`dgii_mensajes`).
 *   rechazada — la DGII no anuló el rango (o la solicitud no se pudo enviar
 *               y se descartó). El rango vuelve a estar disponible.
 */
@Entity("ecf_anulaciones")
@Index("idx_ecf_anulaciones_tipo", ["tipo"])
export class EcfAnulacion {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    /** Tipo de e-CF del rango (31, 32, 34). */
    @Column("integer")
    tipo!: 31 | 32 | 34;

    /** Primer e-NCF anulado (13 posiciones). */
    @Column({ length: 13 })
    desde!: string;

    /** Último e-NCF anulado (13 posiciones). */
    @Column({ length: 13 })
    hasta!: string;

    @Column("integer")
    cantidad!: number;

    @Column({ default: "pendiente" })
    estado!: "pendiente" | "aceptada" | "parcial" | "rechazada";

    /** Ambiente DGII al que se envió (`testecf` / `certecf` / `ecf`). */
    @Column()
    ambiente!: string;

    /** XML ANECF firmado, tal como se envió. */
    @Column({ type: "text", nullable: true })
    signed_xml?: string | null;

    @Column({ type: "varchar", nullable: true })
    dgii_codigo?: string | null;

    @Column({ type: "varchar", nullable: true })
    dgii_nombre?: string | null;

    @Column({ type: "text", nullable: true })
    dgii_mensajes?: string | null;

    @Column({ type: "text", nullable: true })
    last_error?: string | null;

    @Column({ type: "varchar", nullable: true })
    username?: string | null;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;
}
