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

    /** NCF emitido para esta venta (p. ej. "B0200000143"), si se solicitó. */
    @Column({ nullable: true })
    ncf?: string;

    @Column({ nullable: true })
    ncf_type?: 'B01' | 'B02';

    /** RNC/cédula del cliente (obligatorio en B01). */
    @Column({ nullable: true })
    fiscal_customer_rnc?: string;

    @Column({ nullable: true })
    fiscal_customer_name?: string;

    /** ITBIS incluido en total_amount (0 si todo exento). */
    @Column("decimal", { precision: 10, scale: 2, nullable: true })
    itbis_amount?: number;

    /** NCF de la Nota de Crédito (B04) emitida al anular esta venta. */
    @Column({ nullable: true })
    credit_note_ncf?: string;

    /** Fecha de anulación (la Nota de Crédito B04 se reporta con esta fecha). */
    @Column({ type: "datetime", nullable: true })
    voided_at?: Date;

    @CreateDateColumn()
    created_at!: Date;

    @OneToMany(() => SaleItem, (item) => item.sale, { cascade: true })
    items!: SaleItem[];
}

