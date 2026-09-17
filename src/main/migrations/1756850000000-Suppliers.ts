import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Suplidores: proveedores, compras (entradas de inventario con costo) y
 * cuentas por pagar con sus pagos.
 */
export class Suppliers1756850000000 implements MigrationInterface {
    name = 'Suppliers1756850000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "suppliers" (
            "id" varchar PRIMARY KEY NOT NULL,
            "name" varchar NOT NULL,
            "rnc" varchar,
            "contact_name" varchar,
            "phone" varchar,
            "email" varchar,
            "address" varchar,
            "notes" varchar,
            "credit_days" integer NOT NULL DEFAULT (0),
            "balance" decimal(10,2) NOT NULL DEFAULT (0),
            "active" boolean NOT NULL DEFAULT (1),
            "created_at" datetime NOT NULL DEFAULT (datetime('now')),
            "updated_at" datetime NOT NULL DEFAULT (datetime('now'))
        )`);

        await queryRunner.query(`CREATE TABLE "purchases" (
            "id" varchar PRIMARY KEY NOT NULL,
            "supplier_id" varchar NOT NULL,
            "supplier_name" varchar NOT NULL,
            "invoice_number" varchar,
            "status" varchar NOT NULL DEFAULT ('received'),
            "payment_status" varchar NOT NULL DEFAULT ('pending'),
            "total_amount" decimal(10,2) NOT NULL,
            "amount_paid" decimal(10,2) NOT NULL DEFAULT (0),
            "due_date" datetime,
            "notes" varchar,
            "user_id" varchar,
            "username" varchar,
            "updated_costs" boolean NOT NULL DEFAULT (1),
            "created_at" datetime NOT NULL DEFAULT (datetime('now')),
            "cancelled_at" datetime,
            CONSTRAINT "fk_purchases_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id")
        )`);
        await queryRunner.query(`CREATE INDEX "idx_purchases_supplier" ON "purchases" ("supplier_id")`);
        await queryRunner.query(`CREATE INDEX "idx_purchases_created" ON "purchases" ("created_at")`);
        await queryRunner.query(`CREATE INDEX "idx_purchases_status" ON "purchases" ("status")`);

        await queryRunner.query(`CREATE TABLE "purchase_items" (
            "id" varchar PRIMARY KEY NOT NULL,
            "purchase_id" varchar NOT NULL,
            "product_id" varchar,
            "product_name" varchar NOT NULL,
            "quantity" integer NOT NULL,
            "unit_cost" decimal(10,2) NOT NULL,
            "total_cost" decimal(10,2) NOT NULL,
            "previous_cost" decimal(10,2),
            CONSTRAINT "fk_purchase_items_purchase" FOREIGN KEY ("purchase_id") REFERENCES "purchases" ("id") ON DELETE CASCADE,
            CONSTRAINT "fk_purchase_items_product" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE SET NULL
        )`);
        await queryRunner.query(`CREATE INDEX "idx_purchase_items_purchase" ON "purchase_items" ("purchase_id")`);
        await queryRunner.query(`CREATE INDEX "idx_purchase_items_product" ON "purchase_items" ("product_id")`);

        await queryRunner.query(`CREATE TABLE "supplier_payments" (
            "id" varchar PRIMARY KEY NOT NULL,
            "supplier_id" varchar NOT NULL,
            "purchase_id" varchar,
            "amount" decimal(10,2) NOT NULL,
            "payment_method" varchar NOT NULL DEFAULT ('cash'),
            "shift_id" varchar,
            "shift_expense_id" varchar,
            "notes" varchar,
            "user_id" varchar,
            "username" varchar,
            "created_at" datetime NOT NULL DEFAULT (datetime('now')),
            CONSTRAINT "fk_supplier_payments_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id")
        )`);
        await queryRunner.query(`CREATE INDEX "idx_supplier_payments_supplier" ON "supplier_payments" ("supplier_id")`);
        await queryRunner.query(`CREATE INDEX "idx_supplier_payments_created" ON "supplier_payments" ("created_at")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "supplier_payments"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "purchase_items"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "purchases"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "suppliers"`);
    }
}
