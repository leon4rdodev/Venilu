import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Initial schema — the exact DDL that `synchronize: true` produced as of
 * 2026-08-25 (13 tables, 20 indices), captured from a fresh database.
 *
 * Existing installs built by the old synchronize mode are BASELINED at boot
 * (marked as already applied without executing) — see
 * src/main/config/run-migrations.ts. Any future schema change must ship as a
 * NEW migration file registered in data-source.ts; never edit this one.
 */
export class InitialSchema1756150000000 implements MigrationInterface {
    name = 'InitialSchema1756150000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "audit_logs" ("id" varchar PRIMARY KEY NOT NULL, "user_id" varchar NOT NULL, "username" varchar NOT NULL, "action" varchar NOT NULL, "target_id" varchar, "target_label" varchar, "metadata" text, "created_at" datetime NOT NULL DEFAULT (datetime('now')))`);
        await queryRunner.query(`CREATE TABLE "categories" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar NOT NULL, "created_at" datetime NOT NULL DEFAULT (datetime('now')), "updated_at" datetime NOT NULL DEFAULT (datetime('now')))`);
        await queryRunner.query(`CREATE TABLE "customers" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar NOT NULL, "phone" varchar, "email" varchar, "address" varchar, "notes" varchar, "balance" decimal(10,2) NOT NULL DEFAULT (0), "credit_limit" decimal(10,2), "created_at" datetime NOT NULL DEFAULT (datetime('now')), "updated_at" datetime NOT NULL DEFAULT (datetime('now')))`);
        await queryRunner.query(`CREATE TABLE "debt_payments" ("id" varchar PRIMARY KEY NOT NULL, "customer_id" varchar NOT NULL, "shift_id" varchar, "amount" decimal(10,2) NOT NULL, "payment_method" varchar NOT NULL DEFAULT ('cash'), "notes" varchar, "created_at" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_a7af5d9c4c328b6a15f4f2116b9" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_5c44ef29969bebd4b951fac4c9d" FOREIGN KEY ("shift_id") REFERENCES "shifts" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`CREATE TABLE "products" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar NOT NULL, "description" varchar, "sale_price" decimal(10,2) NOT NULL, "cost_price" decimal(10,2) NOT NULL DEFAULT (0), "stock" integer NOT NULL DEFAULT (0), "barcode" varchar, "sku" varchar, "min_stock" integer NOT NULL DEFAULT (5), "image" varchar, "category_id" varchar, "created_at" datetime NOT NULL DEFAULT (datetime('now')), "updated_at" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_9a5f6868c96e0069e699f33e124" FOREIGN KEY ("category_id") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`CREATE TABLE "roles" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar NOT NULL, "is_system" boolean NOT NULL DEFAULT (0), "permissions" text NOT NULL DEFAULT ('[]'), "created_at" datetime NOT NULL DEFAULT (datetime('now')), "updated_at" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_648e3f5447f725579d7d4ffdfb7" UNIQUE ("name"))`);
        await queryRunner.query(`CREATE TABLE "sale_items" ("id" varchar PRIMARY KEY NOT NULL, "sale_id" varchar NOT NULL, "product_id" varchar NOT NULL, "product_name" varchar, "quantity" integer NOT NULL, "unit_price" decimal(10,2), "total_price" decimal(10,2), CONSTRAINT "FK_c210a330b80232c29c2ad68462a" FOREIGN KEY ("sale_id") REFERENCES "sales" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_4ecae62db3f9e9cc9a368d57adb" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`CREATE TABLE "sales" ("id" varchar PRIMARY KEY NOT NULL, "user_id" varchar NOT NULL, "shift_id" varchar, "customer_id" varchar, "customer_name" varchar, "subtotal" decimal(10,2) NOT NULL DEFAULT (0), "discount_amount" decimal(10,2) NOT NULL DEFAULT (0), "total_amount" decimal(10,2) NOT NULL, "amount_paid" decimal(10,2), "change_given" decimal(10,2), "payment_method" varchar NOT NULL, "status" varchar NOT NULL DEFAULT ('paid'), "created_at" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_5f282f3656814ec9ca2675aef6f" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_10a00ff24a92e0043beaf9c1661" FOREIGN KEY ("shift_id") REFERENCES "shifts" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_c51005b2b06cec7aa17462c54f5" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`CREATE TABLE "settings" ("id" integer PRIMARY KEY NOT NULL DEFAULT (1), "business_name" varchar, "business_address" varchar, "business_phone" varchar, "business_email" varchar, "business_tax_id" varchar, "logo_filename" varchar, "printer_name" varchar, "paper_size" varchar NOT NULL DEFAULT ('80mm'), "currency" varchar NOT NULL DEFAULT ('DOP'), "receipt_footer" text, "auto_print_receipt" boolean NOT NULL DEFAULT (0), "auto_backup" varchar NOT NULL DEFAULT ('daily'), "auto_backup_retention" integer NOT NULL DEFAULT (7))`);
        await queryRunner.query(`CREATE TABLE "shift_expenses" ("id" varchar PRIMARY KEY NOT NULL, "shift_id" varchar NOT NULL, "amount" decimal(10,2) NOT NULL, "reason" varchar NOT NULL, "created_at" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_d0c5d1788098c92e04e9244ab8b" FOREIGN KEY ("shift_id") REFERENCES "shifts" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`CREATE TABLE "shifts" ("id" varchar PRIMARY KEY NOT NULL, "user_id" varchar NOT NULL, "start_time" datetime NOT NULL DEFAULT (datetime('now')), "end_time" datetime, "initial_cash" decimal(10,2) NOT NULL DEFAULT (0), "final_cash" decimal(10,2), "expected_cash" decimal(10,2), "difference" decimal(10,2), "status" varchar NOT NULL DEFAULT ('open'), "force_closed" boolean NOT NULL DEFAULT (0), "force_closed_by" varchar, "force_close_reason" varchar, CONSTRAINT "FK_dc1e84f1d1e75e990952c40859c" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`CREATE TABLE "stock_movements" ("id" varchar PRIMARY KEY NOT NULL, "product_id" varchar NOT NULL, "type" varchar NOT NULL, "quantity_delta" integer NOT NULL, "stock_after" integer NOT NULL, "reference" varchar, "user_id" varchar, "username" varchar, "note" varchar, "created_at" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_2c1bb05b80ddcc562cd28d826c6" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`CREATE TABLE "users" ("id" varchar PRIMARY KEY NOT NULL, "username" varchar NOT NULL, "password" varchar NOT NULL, "name" varchar NOT NULL, "role" varchar NOT NULL DEFAULT ('employee'), "role_id" varchar, "session_token" varchar, "created_at" datetime NOT NULL DEFAULT (datetime('now')), "updated_at" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`CREATE INDEX "IDX_048a28949bb332d397edb9b7ab" ON "products" ("stock") `);
        await queryRunner.query(`CREATE INDEX "IDX_4c9fb58de893725258746385e1" ON "products" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_9a5f6868c96e0069e699f33e12" ON "products" ("category_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_9bd9716f475081e1f21146bbef" ON "products" ("min_stock") `);
        await queryRunner.query(`CREATE INDEX "IDX_adfc522baf9d9b19cd7d9461b7" ON "products" ("barcode") `);
        await queryRunner.query(`CREATE INDEX "IDX_c44ac33a05b144dd0d9ddcf932" ON "products" ("sku") `);
        await queryRunner.query(`CREATE INDEX "idx_audit_action" ON "audit_logs" ("action") `);
        await queryRunner.query(`CREATE INDEX "idx_audit_created_at" ON "audit_logs" ("created_at") `);
        await queryRunner.query(`CREATE INDEX "idx_debt_payments_customer" ON "debt_payments" ("customer_id") `);
        await queryRunner.query(`CREATE INDEX "idx_debt_payments_shift" ON "debt_payments" ("shift_id") `);
        await queryRunner.query(`CREATE INDEX "idx_sale_items_product" ON "sale_items" ("product_id") `);
        await queryRunner.query(`CREATE INDEX "idx_sale_items_sale" ON "sale_items" ("sale_id") `);
        await queryRunner.query(`CREATE INDEX "idx_sales_created_at" ON "sales" ("created_at") `);
        await queryRunner.query(`CREATE INDEX "idx_sales_customer" ON "sales" ("customer_id") `);
        await queryRunner.query(`CREATE INDEX "idx_sales_shift" ON "sales" ("shift_id") `);
        await queryRunner.query(`CREATE INDEX "idx_sales_status" ON "sales" ("status") `);
        await queryRunner.query(`CREATE INDEX "idx_shift_expenses_shift" ON "shift_expenses" ("shift_id") `);
        await queryRunner.query(`CREATE INDEX "idx_shifts_user_status" ON "shifts" ("user_id", "status") `);
        await queryRunner.query(`CREATE INDEX "idx_stock_movements_created" ON "stock_movements" ("created_at") `);
        await queryRunner.query(`CREATE INDEX "idx_stock_movements_product" ON "stock_movements" ("product_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_048a28949bb332d397edb9b7ab"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_4c9fb58de893725258746385e1"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_9a5f6868c96e0069e699f33e12"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_9bd9716f475081e1f21146bbef"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_adfc522baf9d9b19cd7d9461b7"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_c44ac33a05b144dd0d9ddcf932"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_audit_action"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_audit_created_at"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_debt_payments_customer"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_debt_payments_shift"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sale_items_product"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sale_items_sale"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sales_created_at"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sales_customer"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sales_shift"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sales_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_shift_expenses_shift"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_shifts_user_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_stock_movements_created"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_stock_movements_product"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "stock_movements"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "shifts"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "shift_expenses"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "settings"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "sales"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "sale_items"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "roles"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "debt_payments"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "customers"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "categories"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    }
}
