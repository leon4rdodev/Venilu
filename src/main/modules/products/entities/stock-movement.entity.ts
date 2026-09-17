import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm";
import { Product } from "./product.entity";

/**
 * Kardex: immutable, append-only trail of every stock change.
 *   - 'sale'       → quantity sold (negative delta), reference = sale id
 *   - 'void'       → restock from a voided sale (positive delta), reference = sale id
 *   - 'adjustment' → manual stock edit from inventory (either sign)
 *   - 'initial'    → opening stock recorded at product creation
 *   - 'return'     → restock from a partial return, reference = sale id
 *   - 'purchase'   → goods received from a supplier, reference = purchase id
 *   - 'purchase_void' → reversal of a cancelled purchase
 */
@Entity("stock_movements")
@Index("idx_stock_movements_product", ["product_id"])
@Index("idx_stock_movements_created", ["created_at"])
export class StockMovement {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    product_id!: string;

    @ManyToOne(() => Product, { onDelete: 'CASCADE' })
    @JoinColumn({ name: "product_id" })
    product?: Product;

    @Column()
    type!: 'sale' | 'void' | 'adjustment' | 'initial' | 'return' | 'purchase' | 'purchase_void';

    /** Signed change: negative for sales, positive for restocks/increases. */
    @Column("integer")
    quantity_delta!: number;

    /** Stock level right after this movement was applied. */
    @Column("integer")
    stock_after!: number;

    /** Related entity id (sale id for sale/void movements). */
    @Column({ nullable: true })
    reference?: string;

    @Column({ nullable: true })
    user_id?: string;

    /** Username snapshot at the time of the movement. */
    @Column({ nullable: true })
    username?: string;

    @Column({ nullable: true })
    note?: string;

    @CreateDateColumn()
    created_at!: Date;
}
