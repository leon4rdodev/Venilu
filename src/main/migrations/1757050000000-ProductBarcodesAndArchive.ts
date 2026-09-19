import { MigrationInterface, QueryRunner } from "typeorm";
import crypto from "crypto";

/**
 * 1) Códigos de barras adicionales ilimitados por producto (`product_barcodes`).
 * 2) Borrado lógico de productos (`products.archived_at`): archivar en vez de
 *    eliminar, con carpeta de archivados para restaurar o borrar definitivamente.
 *
 * Además convierte las notas "Códigos alternos: a, b" que dejó la importación
 * de inventario (cuando solo cabían 2 códigos) en códigos reales escaneables.
 */
export class ProductBarcodesAndArchive1757050000000 implements MigrationInterface {
    name = 'ProductBarcodesAndArchive1757050000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "product_barcodes" (
                "id" varchar PRIMARY KEY NOT NULL,
                "product_id" varchar NOT NULL,
                "code" varchar NOT NULL,
                "created_at" datetime NOT NULL DEFAULT (datetime('now')),
                CONSTRAINT "fk_product_barcodes_product" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `);
        await queryRunner.query(`CREATE INDEX "idx_product_barcodes_product" ON "product_barcodes" ("product_id")`);
        await queryRunner.query(`CREATE INDEX "idx_product_barcodes_code" ON "product_barcodes" ("code")`);

        await queryRunner.query(`ALTER TABLE "products" ADD COLUMN "archived_at" datetime`);
        await queryRunner.query(`CREATE INDEX "idx_products_archived" ON "products" ("archived_at")`);

        const PREFIX = 'Códigos alternos: ';
        const rows: Array<{ id: string; description: string }> = await queryRunner.query(
            `SELECT "id", "description" FROM "products" WHERE "description" LIKE ?`, [`${PREFIX}%`]
        );
        for (const row of rows) {
            const codes = row.description.slice(PREFIX.length).split(',').map((c) => c.trim()).filter(Boolean);
            // Un código nunca lleva espacios (los QR de fabricante pueden ser URLs). Si los hay, es texto del usuario: no tocar
            if (codes.length === 0 || codes.some((c) => /\s/.test(c) || c.length > 64)) continue;
            for (const code of codes) {
                const taken: unknown[] = await queryRunner.query(
                    `SELECT 1 FROM "products" WHERE "barcode" = ? OR "sku" = ? UNION ALL SELECT 1 FROM "product_barcodes" WHERE "code" = ?`,
                    [code, code, code]
                );
                if (taken.length > 0) continue;
                await queryRunner.query(
                    `INSERT INTO "product_barcodes" ("id", "product_id", "code") VALUES (?, ?, ?)`,
                    [crypto.randomUUID(), row.id, code]
                );
            }
            await queryRunner.query(`UPDATE "products" SET "description" = NULL WHERE "id" = ?`, [row.id]);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_products_archived"`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "archived_at"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_product_barcodes_code"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_product_barcodes_product"`);
        await queryRunner.query(`DROP TABLE "product_barcodes"`);
    }
}
