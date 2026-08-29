import { MigrationInterface, QueryRunner } from "typeorm";

/** Devoluciones parciales: cabecera + líneas devueltas por venta. */
export class SaleReturns1756550000000 implements MigrationInterface {
    name = 'SaleReturns1756550000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "sale_returns" (
            "id" varchar PRIMARY KEY NOT NULL,
            "sale_id" varchar NOT NULL,
            "user_id" varchar NOT NULL,
            "username" varchar,
            "shift_id" varchar,
            "total_refunded" decimal(10,2) NOT NULL,
            "itbis_refunded" decimal(10,2) NOT NULL DEFAULT (0),
            "cost_refunded" decimal(10,2) NOT NULL DEFAULT (0),
            "credit_note_ncf" varchar,
            "note" varchar,
            "created_at" datetime NOT NULL DEFAULT (datetime('now'))
        )`);
        await queryRunner.query(`CREATE INDEX "idx_sale_returns_sale" ON "sale_returns" ("sale_id")`);
        await queryRunner.query(`CREATE INDEX "idx_sale_returns_shift" ON "sale_returns" ("shift_id")`);
        await queryRunner.query(`CREATE INDEX "idx_sale_returns_created" ON "sale_returns" ("created_at")`);

        await queryRunner.query(`CREATE TABLE "sale_return_items" (
            "id" varchar PRIMARY KEY NOT NULL,
            "return_id" varchar NOT NULL,
            "sale_item_id" varchar NOT NULL,
            "product_id" varchar NOT NULL,
            "product_name" varchar,
            "quantity" integer NOT NULL,
            "amount_refunded" decimal(10,2) NOT NULL,
            "itbis_refunded" decimal(10,2) NOT NULL DEFAULT (0),
            CONSTRAINT "fk_sale_return_items_return" FOREIGN KEY ("return_id") REFERENCES "sale_returns" ("id") ON DELETE CASCADE
        )`);
        await queryRunner.query(`CREATE INDEX "idx_sale_return_items_return" ON "sale_return_items" ("return_id")`);
        await queryRunner.query(`CREATE INDEX "idx_sale_return_items_sale_item" ON "sale_return_items" ("sale_item_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "sale_return_items"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sale_returns_created"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sale_returns_shift"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sale_returns_sale"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "sale_returns"`);
    }
}
