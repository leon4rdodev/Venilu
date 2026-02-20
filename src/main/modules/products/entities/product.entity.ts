import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Category } from "@main/modules/categories/entities/category.entity";

@Entity("products")
export class Product {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    name!: string;

    @Column({ nullable: true })
    description?: string;

    @Column("decimal", { precision: 10, scale: 2 })
    sale_price!: number;

    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    cost_price!: number;

    @Column("integer", { default: 0 })
    stock!: number;

    @Column({ nullable: true })
    barcode?: string;

    @Column({ nullable: true })
    sku?: string;

    @Column("integer", { default: 5 })
    min_stock!: number;

    @Column({ nullable: true })
    image?: string; // Storing as base64 or path

    @Column({ nullable: true })
    category_id?: string;

    @ManyToOne(() => Category, (category) => category.products, { onDelete: 'SET NULL' })
    @JoinColumn({ name: "category_id" })
    category?: Category;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;
}
