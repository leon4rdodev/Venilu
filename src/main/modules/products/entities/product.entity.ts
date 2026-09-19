import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from "typeorm";
import { Category } from "@main/modules/categories/entities/category.entity";
import { ProductBarcode } from "@main/modules/products/entities/product-barcode.entity";

@Entity("products")
export class Product {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Index()
    @Column()
    name!: string;

    @Column({ nullable: true })
    description?: string;

    @Column("decimal", { precision: 10, scale: 2 })
    sale_price!: number;

    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    cost_price!: number;

    @Index()
    @Column("integer", { default: 0 })
    stock!: number;

    @Index()
    @Column({ nullable: true })
    barcode?: string;

    @Index()
    @Column({ nullable: true })
    sku?: string;

    /** Códigos de barras adicionales (ilimitados) — el principal es `barcode`. */
    @OneToMany(() => ProductBarcode, (b) => b.product)
    barcodes?: ProductBarcode[];

    @Index()
    @Column("integer", { default: 5 })
    min_stock!: number;

    /**
     * Presentación/variante: producto hijo de otro ("Pequeño 250ml").
     * Solo un nivel — una presentación no puede tener presentaciones.
     */
    @Index()
    @Column({ nullable: true })
    parent_product_id?: string;

    @ManyToOne(() => Product, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: "parent_product_id" })
    parent?: Product;

    /** Etiqueta de la presentación, p. ej. "Pequeño 250ml" o "Caja x24". */
    @Column({ nullable: true })
    variant_name?: string;

    /** true = exento de ITBIS (víveres básicos, medicinas...). Default: gravado 18%. */
    @Column({ default: false })
    itbis_exempt!: boolean;

    @Column({ nullable: true })
    image?: string; // Managed file name (prod_*.webp) served via venilu://product-images/ — never raw bytes

    @Index()
    @Column({ nullable: true })
    category_id?: string;

    @ManyToOne(() => Category, (category) => category.products, { onDelete: 'SET NULL' })
    @JoinColumn({ name: "category_id" })
    category?: Category;

    /**
     * Borrado lógico: con fecha = archivado (oculto de inventario, POS y
     * escáner, pero conservado para el historial de ventas). null = activo.
     */
    @Index()
    @Column({ type: "datetime", nullable: true })
    archived_at?: Date | null;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;
}
