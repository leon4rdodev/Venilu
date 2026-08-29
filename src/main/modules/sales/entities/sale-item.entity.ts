import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { Sale } from "@main/modules/sales/entities/sale.entity";
import { Product } from "@main/modules/products/entities/product.entity";

@Entity("sale_items")
// Joined on sale_id for every sale detail and grouped by product_id in the
// product rankings — both need an index (SQLite does not index FKs).
@Index("idx_sale_items_sale", ["sale_id"])
@Index("idx_sale_items_product", ["product_id"])
export class SaleItem {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    sale_id!: string;

    @ManyToOne(() => Sale, (sale) => sale.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: "sale_id" })
    sale!: Sale;

    @Column()
    product_id!: string;

    @ManyToOne(() => Product)
    @JoinColumn({ name: "product_id" })
    product?: Product;

    @Column({ nullable: true })
    product_name?: string; // Snapshot of product name at time of sale

    @Column("integer")
    quantity!: number;

    @Column("decimal", { precision: 10, scale: 2, nullable: true })
    unit_price?: number; // Snapshot of price

    @Column("decimal", { precision: 10, scale: 2, nullable: true })
    total_price?: number;

    /** ITBIS incluido en total_price (0 = producto exento). Snapshot al vender. */
    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    itbis_amount!: number;
}
