import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany, Index } from "typeorm";
import { User } from "@main/modules/users/entities/user.entity";
import { Shift } from "@main/modules/shifts/entities/shift.entity";
import { SaleItem } from "@main/modules/sales/entities/sale-item.entity";
import { Customer } from "@main/modules/customers/entities/customer.entity";

@Entity("sales")
// Hot paths: reports filter by created_at range + status, shift views by
// shift_id, customer aggregates by customer_id. SQLite creates none of these.
@Index("idx_sales_created_at", ["created_at"])
@Index("idx_sales_status", ["status"])
@Index("idx_sales_shift", ["shift_id"])
@Index("idx_sales_customer", ["customer_id"])
export class Sale {
    @PrimaryColumn()
    id!: string;

    @Column()
    user_id!: string;

    @ManyToOne(() => User, (user) => user.sales)
    @JoinColumn({ name: "user_id" })
    user?: User;

    @Column({ nullable: true })
    shift_id?: string;

    @ManyToOne(() => Shift, (shift) => shift.sales)
    @JoinColumn({ name: "shift_id" })
    shift?: Shift;

    @Column({ nullable: true })
    customer_id?: string;

    @ManyToOne(() => Customer, (customer) => customer.sales)
    @JoinColumn({ name: "customer_id" })
    customer?: Customer;

    @Column({ nullable: true })
    customer_name?: string;

    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    subtotal!: number;

    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    discount_amount!: number;

    @Column("decimal", { precision: 10, scale: 2 })
    total_amount!: number;

    @Column("decimal", { precision: 10, scale: 2, nullable: true })
    amount_paid?: number;

    @Column("decimal", { precision: 10, scale: 2, nullable: true })
    change_given?: number;

    @Column()
    payment_method!: 'cash' | 'card' | 'transfer' | 'credit';

    @Column({ default: 'paid' })
    status!: 'paid' | 'credit' | 'partial' | 'voided';

    @CreateDateColumn()
    created_at!: Date;

    @OneToMany(() => SaleItem, (item) => item.sale, { cascade: true })
    items!: SaleItem[];
}

