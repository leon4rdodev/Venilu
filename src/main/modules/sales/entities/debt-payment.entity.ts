import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Customer } from "@main/modules/customers/entities/customer.entity";
import { Shift } from "@main/modules/shifts/entities/shift.entity";

@Entity("debt_payments")
export class DebtPayment {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    customer_id!: string;

    @ManyToOne(() => Customer)
    @JoinColumn({ name: "customer_id" })
    customer?: Customer;

    @Column({ nullable: true })
    shift_id?: string;

    @ManyToOne(() => Shift)
    @JoinColumn({ name: "shift_id" })
    shift?: Shift;

    @Column("decimal", { precision: 10, scale: 2 })
    amount!: number;

    /** 'cash' | 'transfer' */
    @Column({ default: 'cash' })
    payment_method!: 'cash' | 'transfer';

    @Column({ nullable: true })
    notes?: string;

    @CreateDateColumn()
    created_at!: Date;
}
