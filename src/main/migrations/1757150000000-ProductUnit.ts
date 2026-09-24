import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Unidades de medida de producto:
 *   - products.unit  → 'unidad' (default, enteros) | libra | kilo | litro…
 *   - sale_items.unit → snapshot de la unidad al momento de vender (los
 *     tickets, devoluciones y el historial muestran la medida aunque el
 *     producto cambie o se archive).
 *
 * Solo ADD COLUMN (operación trivial en SQLite, sin rebuild de tablas):
 * las columnas existentes de cantidades (stock, quantity, quantity_delta…)
 * tienen afinidad INTEGER, que en SQLite PRESERVA valores con decimales
 * (solo convierte a entero si la conversión es sin pérdida), por lo que
 * soportan 12.5 lb / 0.5 unidades sin alterar el esquema.
 */
export class ProductUnit1757150000000 implements MigrationInterface {
    name = 'ProductUnit1757150000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "products" ADD COLUMN "unit" varchar NOT NULL DEFAULT 'unidad'`);
        await queryRunner.query(`ALTER TABLE "sale_items" ADD COLUMN "unit" varchar NOT NULL DEFAULT 'unidad'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sale_items" DROP COLUMN "unit"`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "unit"`);
    }
}
