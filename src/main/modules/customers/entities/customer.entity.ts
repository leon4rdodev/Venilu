import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm";
import { Sale } from "@main/modules/sales/entities/sale.entity";

export type TaxRegime =
  | "general"
  | "simplified"
  | "special"
  | "non_profit"
  | "government"
  | "foreign";

@Entity("customers")
export class Customer {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    name!: string;

    @Column({ nullable: true })
    phone?: string;

    @Column({ nullable: true })
    email?: string;

    @Column({ nullable: true })
    address?: string;

    @Column({ nullable: true })
    notes?: string;

    /** RNC (Registro Nacional del Contribuyente) — 9 dígitos */
    @Column({ nullable: true, length: 9 })
    rnc?: string;

    /** Razón social — nombre fiscal de la empresa */
    @Column({ nullable: true })
    business_name?: string;

    /** Régimen de tributación DGII */
    @Column({ nullable: true })
    tax_regime?: TaxRegime;

    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    balance!: number;

    /** Maximum credit balance allowed. NULL = unlimited. */
    @Column("decimal", { precision: 10, scale: 2, nullable: true })
    credit_limit?: number;

    @OneToMany(() => Sale, (sale) => sale.customer)
    sales?: Sale[];

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;
}
