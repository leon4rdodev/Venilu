import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm";
import { Supplier } from "./supplier.entity";

/**
 * Pago a un suplidor. Reduce su cuenta por pagar y se aplica FIFO a las
 * compras pendientes. Si es en efectivo sale de la caja del turno abierto
 * (se registra además como salida de caja del turno).
 */
@Entity("supplier_payments")
@Index("idx_supplier_payments_supplier", ["supplier_id"])
@Index("idx_supplier_payments_created", ["created_at"])
export class SupplierPayment {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    supplier_id!: string;

    @ManyToOne(() => Supplier)
    @JoinColumn({ name: "supplier_id" })
    supplier?: Supplier;

    /** Compra pagada en el mismo acto (pago al recibir); null si es un abono general. */
    @Column({ type: "varchar", nullable: true })
    purchase_id?: string | null;

    @Column("decimal", { precision: 10, scale: 2 })
    amount!: number;

    @Column({ type: "varchar", default: 'cash' })
    payment_method!: 'cash' | 'transfer';

    /** Turno del que salió el efectivo (solo pagos en efectivo). */
    @Column({ type: "varchar", nullable: true })
    shift_id?: string | null;

    /** Salida de caja creada para el arqueo (solo pagos en efectivo). */
    @Column({ type: "varchar", nullable: true })
    shift_expense_id?: string | null;

    @Column({ nullable: true })
    notes?: string;

    @Column({ nullable: true })
    user_id?: string;

    @Column({ nullable: true })
    username?: string;

    @CreateDateColumn()
    created_at!: Date;
}
