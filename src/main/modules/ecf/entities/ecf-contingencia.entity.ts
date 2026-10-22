import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

/**
 * Período de **contingencia por imposibilidad técnica** para emitir e-CF.
 *
 * Fuente: *Informe Técnico e-CF* (marzo 2026), §19.2 — ver
 * `docs/fec/REQUISITOS.md` §4.19. Mientras haya un período abierto
 * (`hasta IS NULL`), las ventas con comprobante usan secuencias NO
 * electrónicas (serie B); al cerrarlo, cada una se reemplaza por un e-CF con
 * `CodigoModificacion` 4 que va solo a la DGII.
 *
 * El inicio y la salida también deben registrarse en la Oficina Virtual
 * (Facturación Electrónica → Contingencia FE): esta tabla es el registro
 * local, no sustituye ese trámite.
 */
@Entity("ecf_contingencias")
export class EcfContingencia {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "datetime" })
    desde!: Date;

    /** `null` mientras la contingencia sigue abierta. */
    @Column({ type: "datetime", nullable: true })
    hasta?: Date | null;

    @Column({ type: "text" })
    motivo!: string;

    @Column({ type: "text", nullable: true })
    motivo_fin?: string | null;

    @Column({ type: "varchar", nullable: true })
    username?: string | null;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;
}
