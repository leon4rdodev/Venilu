import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm";
import { Purchase } from "./purchase.entity";

/**
 * Suplidor (proveedor): a quién se le compra mercancía. `balance` es lo que
 * el negocio le DEBE (cuentas por pagar) — sube con compras a crédito y baja
 * con los pagos.
 */
@Entity("suppliers")
export class Supplier {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    name!: string;

    /** RNC / cédula del suplidor (para sus facturas). */
    @Column({ nullable: true })
    rnc?: string;

    /** Persona de contacto (vendedor / ruta). */
    @Column({ nullable: true })
    contact_name?: string;

    @Column({ nullable: true })
    phone?: string;

    @Column({ nullable: true })
    email?: string;

    @Column({ nullable: true })
    address?: string;

    @Column({ nullable: true })
    notes?: string;

    /** Días de crédito que otorga el suplidor (0 = de contado). */
    @Column("integer", { default: 0 })
    credit_days!: number;

    /** Cuenta por pagar acumulada. */
    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    balance!: number;

    @Column({ default: true })
    active!: boolean;

    @OneToMany(() => Purchase, (purchase) => purchase.supplier)
    purchases?: Purchase[];

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;
}
