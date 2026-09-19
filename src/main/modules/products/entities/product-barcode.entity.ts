import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm";
import { Product } from "@main/modules/products/entities/product.entity";

/**
 * Código de barras ADICIONAL de un producto. Un mismo producto puede venir
 * con varios códigos (sabores, lotes, empaques del fabricante) que se venden
 * al mismo precio y comparten stock. El código principal sigue viviendo en
 * `products.barcode`; aquí van todos los demás, sin límite.
 */
@Entity("product_barcodes")
export class ProductBarcode {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Index()
    @Column()
    product_id!: string;

    @ManyToOne(() => Product, (product) => product.barcodes, { onDelete: 'CASCADE' })
    @JoinColumn({ name: "product_id" })
    product?: Product;

    @Index()
    @Column()
    code!: string;

    @CreateDateColumn()
    created_at!: Date;
}
