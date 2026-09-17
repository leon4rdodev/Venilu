import { Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany, Index } from "typeorm";
import { Supplier } from "./supplier.entity";
import { Product } from "@main/modules/products/entities/product.entity";

export type PurchaseStatus = 'received' | 'cancelled';
export type PurchasePaymentStatus = 'paid' | 'partial' | 'pending';

/**
 * Compra de mercancía a un suplidor. Al registrarse ENTRA al inventario
 * (kardex 'purchase') y, si no se paga completa, la diferencia queda como
 * cuenta por pagar en el balance del suplidor.
 */
@Entity("purchases")
@Index("idx_purchases_supplier", ["supplier_id"])
@Index("idx_purchases_created", ["created_at"])
@Index("idx_purchases_status", ["status"])
export class Purchase {
    /** Id corto legible (mismo formato que ventas). */
    @PrimaryColumn()
    id!: string;

    @Column()
    supplier_id!: string;

    @ManyToOne(() => Supplier, (s) => s.purchases)
    @JoinColumn({ name: "supplier_id" })
    supplier?: Supplier;

    /** Snapshot del nombre del suplidor. */
    @Column()
    supplier_name!: string;

    /** Número de factura / NCF del suplidor. */
    @Column({ nullable: true })
    invoice_number?: string;

    @Column({ type: "varchar", default: 'received' })
    status!: PurchaseStatus;

    @Column({ type: "varchar", default: 'pending' })
    payment_status!: PurchasePaymentStatus;

    @Column("decimal", { precision: 10, scale: 2 })
    total_amount!: number;

    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    amount_paid!: number;

    /** Fecha de vencimiento del crédito del suplidor (null = de contado). */
    @Column({ type: "datetime", nullable: true })
    due_date?: Date | null;

    @Column({ nullable: true })
    notes?: string;

    @Column({ nullable: true })
    user_id?: string;

    @Column({ nullable: true })
    username?: string;

    /** true si los costos de los productos se actualizaron con esta compra. */
    @Column({ default: true })
    updated_costs!: boolean;

    @OneToMany(() => PurchaseItem, (item) => item.purchase, { cascade: true })
    items!: PurchaseItem[];

    @CreateDateColumn()
    created_at!: Date;

    @Column({ type: "datetime", nullable: true })
    cancelled_at?: Date | null;
}

@Entity("purchase_items")
@Index("idx_purchase_items_purchase", ["purchase_id"])
@Index("idx_purchase_items_product", ["product_id"])
export class PurchaseItem {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    purchase_id!: string;

    @ManyToOne(() => Purchase, (p) => p.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: "purchase_id" })
    purchase!: Purchase;

    @Column()
    product_id!: string;

    @ManyToOne(() => Product, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: "product_id" })
    product?: Product;

    @Column()
    product_name!: string;

    @Column("integer")
    quantity!: number;

    @Column("decimal", { precision: 10, scale: 2 })
    unit_cost!: number;

    @Column("decimal", { precision: 10, scale: 2 })
    total_cost!: number;

    /** Costo del producto ANTES de esta compra (trazabilidad de precios). */
    @Column("decimal", { precision: 10, scale: 2, nullable: true })
    previous_cost?: number | null;
}
