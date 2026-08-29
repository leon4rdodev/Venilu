import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Fase 1 fiscal (República Dominicana):
 *   - Secuencias de NCF autorizadas por la DGII (B01/B02/B04).
 *   - ITBIS: exención por producto, tasa en ajustes, desglose por venta/línea.
 *   - Datos del comprobante en la venta (NCF, tipo, cliente fiscal) y de la
 *     Nota de Crédito B04 emitida al anular.
 */
export class FiscalNcf1756450000000 implements MigrationInterface {
    name = 'FiscalNcf1756450000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "ncf_sequences" (
            "id" varchar PRIMARY KEY NOT NULL,
            "type" varchar NOT NULL,
            "from_number" integer NOT NULL,
            "to_number" integer NOT NULL,
            "next_number" integer NOT NULL,
            "expires_at" varchar,
            "active" boolean NOT NULL DEFAULT (1),
            "created_at" datetime NOT NULL DEFAULT (datetime('now')),
            "updated_at" datetime NOT NULL DEFAULT (datetime('now'))
        )`);
        await queryRunner.query(`CREATE INDEX "idx_ncf_sequences_type" ON "ncf_sequences" ("type")`);

        await queryRunner.query(`ALTER TABLE "products" ADD COLUMN "itbis_exempt" boolean NOT NULL DEFAULT (0)`);

        await queryRunner.query(`ALTER TABLE "settings" ADD COLUMN "fiscal_enabled" boolean NOT NULL DEFAULT (0)`);
        await queryRunner.query(`ALTER TABLE "settings" ADD COLUMN "itbis_rate" decimal(5,2) NOT NULL DEFAULT (18)`);

        await queryRunner.query(`ALTER TABLE "sales" ADD COLUMN "ncf" varchar`);
        await queryRunner.query(`ALTER TABLE "sales" ADD COLUMN "ncf_type" varchar`);
        await queryRunner.query(`ALTER TABLE "sales" ADD COLUMN "fiscal_customer_rnc" varchar`);
        await queryRunner.query(`ALTER TABLE "sales" ADD COLUMN "fiscal_customer_name" varchar`);
        await queryRunner.query(`ALTER TABLE "sales" ADD COLUMN "itbis_amount" decimal(10,2)`);
        await queryRunner.query(`ALTER TABLE "sales" ADD COLUMN "credit_note_ncf" varchar`);

        await queryRunner.query(`ALTER TABLE "sale_items" ADD COLUMN "itbis_amount" decimal(10,2) NOT NULL DEFAULT (0)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sale_items" DROP COLUMN "itbis_amount"`);
        await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN "credit_note_ncf"`);
        await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN "itbis_amount"`);
        await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN "fiscal_customer_name"`);
        await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN "fiscal_customer_rnc"`);
        await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN "ncf_type"`);
        await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN "ncf"`);
        await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "itbis_rate"`);
        await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "fiscal_enabled"`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "itbis_exempt"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_ncf_sequences_type"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "ncf_sequences"`);
    }
}
