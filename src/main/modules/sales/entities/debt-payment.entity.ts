import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm";
import { Customer } from "@main/modules/customers/entities/customer.entity";
import { Shift } from "@main/modules/shifts/entities/shift.entity";

@Entity("debt_payments")
@Index("idx_debt_payments_customer", ["customer_id"])
@Index("idx_debt_payments_shift", ["shift_id"])
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

    @ManyToOne(() => Shift, (shift) => shift.debt_payments, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: "shift_id" })
    shift?: Shift;

    @Column("decimal", { precision: 10, scale: 2 })
    amount!: number;

    /** 'cash' | 'transfer' */
    @Column({ default: 'cash' })
    payment_method!: 'cash' | 'transfer';

    /**
     * 'payment' = money received from the customer.
     * 'refund'  = money returned (voiding an already-collected credit sale) —
     *             subtracts from income and from the shift's expected cash.
     */
    @Column({ default: 'payment' })
    type!: 'payment' | 'refund';

    /** Related sale id (refunds reference the voided sale). */
    @Column({ nullable: true })
    reference?: string;

    @Column({ nullable: true })
    notes?: string;

    @CreateDateColumn()
    created_at!: Date;
}
