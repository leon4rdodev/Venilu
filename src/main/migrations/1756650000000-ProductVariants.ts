import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Presentaciones/variantes de producto: cada presentación ES un producto
 * completo (foto, precio, barcode, stock, kardex, fiscal propios) vinculado a
 * su producto padre. Solo un nivel: una presentación no puede tener hijas.
 */
export class ProductVariants1756650000000 implements MigrationInterface {
    name = 'ProductVariants1756650000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "products" ADD COLUMN "parent_product_id" varchar`);
        await queryRunner.query(`ALTER TABLE "products" ADD COLUMN "variant_name" varchar`);
        await queryRunner.query(`CREATE INDEX "idx_products_parent" ON "products" ("parent_product_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_products_parent"`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "variant_name"`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "parent_product_id"`);
    }
}
