import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Customer } from "@main/modules/customers/entities/customer.entity";

export type EcStatus =
  | "pending"
  | "sent"
  | "authorized"
  | "rejected"
  | "voided";

export type EcType =
  | "01"
  | "02"
  | "03"
  | "04"
  | "07"
  | "11"
  | "12"
  | "14"
  | "15";

@Entity("ecf_documents")
export class EcDocument {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ unique: true })
    ecf_id!: string;

    @Column({ length: 2 })
    ecf_type!: EcType;

    @Column({ length: 11 })
    ncf!: string;

    @Column({ nullable: true })
    customer_id?: string;

    @ManyToOne(() => Customer, { nullable: true })
    @JoinColumn({ name: "customer_id" })
    customer?: Customer;

    @Column({ nullable: true })
    customer_name?: string;

    @Column({ nullable: true })
    customer_rnc?: string;

    @Column()
    sale_id!: string;

    @Column("decimal", { precision: 10, scale: 2 })
    total_amount!: number;

    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    itbis_total!: number;

    @Column({ default: "pending" })
    status!: EcStatus;

    @Column({ nullable: true })
    authorization_code?: string;

    @Column("text", { nullable: true })
    signed_xml?: string;

    @Column("text", { nullable: true })
    response_xml?: string;

    @Column({ nullable: true })
    sent_at?: Date;

    @Column({ nullable: true })
    authorized_at?: Date;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;
}
