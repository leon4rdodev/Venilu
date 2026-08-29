import { Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany, Index } from "typeorm";
import { Sale } from "./sale.entity";

/**
 * Devolución parcial de una venta: repone stock, reembolsa dinero EN EFECTIVO
 * desde la caja del turno abierto de quien la procesa, y — si la venta llevaba
 * NCF — emite su propia Nota de Crédito B04.
 *
 * Reglas v1: solo ventas pagadas (efectivo/tarjeta/transferencia o crédito ya
 * saldado). Una venta a crédito con deuda pendiente se ANULA, no se devuelve.
 */
@Entity("sale_returns")
@Index("idx_sale_returns_sale", ["sale_id"])
@Index("idx_sale_returns_shift", ["shift_id"])
@Index("idx_sale_returns_created", ["created_at"])
export class SaleReturn {
    /** Short id legible (mismo formato que las ventas). */
    @PrimaryColumn()
    id!: string;

    @Column()
    sale_id!: string;

    @ManyToOne(() => Sale)
    @JoinColumn({ name: "sale_id" })
    sale?: Sale;

    @Column()
    user_id!: string;

    /** Snapshot del usuario que procesó la devolución. */
    @Column({ nullable: true })
    username?: string;

    /** Turno abierto al que se carga el reembolso en efectivo. */
    @Column({ nullable: true })
    shift_id?: string;

    /** Dinero devuelto al cliente (con el descuento de la venta prorrateado). */
    @Column("decimal", { precision: 10, scale: 2 })
    total_refunded!: number;

    /** ITBIS incluido en lo devuelto. */
    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    itbis_refunded!: number;

    /** Costo de la mercancía repuesta (revierte el costo en reportes). */
    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    cost_refunded!: number;

    /** Nota de Crédito B04 emitida (si la venta original llevaba NCF). */
    @Column({ nullable: true })
    credit_note_ncf?: string;

    @Column({ nullable: true })
    note?: string;

    @OneToMany(() => SaleReturnItem, (item) => item.sale_return, { cascade: true })
    items!: SaleReturnItem[];

    @CreateDateColumn()
    created_at!: Date;
}

@Entity("sale_return_items")
@Index("idx_sale_return_items_return", ["return_id"])
@Index("idx_sale_return_items_sale_item", ["sale_item_id"])
export class SaleReturnItem {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    return_id!: string;

    @ManyToOne(() => SaleReturn, (r) => r.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: "return_id" })
    sale_return!: SaleReturn;

    /** Línea original de la venta a la que pertenece esta devolución. */
    @Column()
    sale_item_id!: string;

    @Column()
    product_id!: string;

    @Column({ nullable: true })
    product_name?: string;

    @Column("integer")
    quantity!: number;

    @Column("decimal", { precision: 10, scale: 2 })
    amount_refunded!: number;

    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    itbis_refunded!: number;
}
