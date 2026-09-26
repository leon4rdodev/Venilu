import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Fase 2 — migración a facturación electrónica (e-CF) de la DGII.
 *
 *   - Tabla `ecf_documents`: cada comprobante electrónico con su e-NCF, el
 *     estado de su ciclo de vida, el XML firmado y la respuesta de la DGII.
 *   - Ajustes e-CF: ambiente DGII (`testecf`/`certecf`/`ecf`), ruta y
 *     contraseña del certificado digital del PSFE.
 *   - Retiro de la facturación en papel: se borran las secuencias B01/B02/B04.
 *
 * ── ¿Por qué se BORRAN las secuencias B01/B02/B04? ──────────────────────────
 *
 * Un rango B01/B02/B04 autoriza comprobantes en PAPEL (serie B, 8 dígitos).
 * El e-NCF es otra estructura distinta — `E` + 2 dígitos de tipo + 10
 * secuenciales = 13 posiciones — y los rangos electrónicos los autoriza la
 * DGII aparte en la Oficina Virtual, con su propio `FechaVencimientoSecuencia`.
 * Reutilizar el rango B produciría e-NCF sin autorización, así que no se
 * remapean: se retiran y el negocio registra sus rangos e-NCF en
 * Ajustes → Fiscal.
 *
 * Fuentes: Aviso 06-26 (vencimiento de las series B el 31-10-2026) e
 * Informe Técnico e-CF, sección 7 (estructura del e-NCF) — `docs/fec/FUENTES.md`.
 */
export class EcfDocuments1757450000000 implements MigrationInterface {
    name = 'EcfDocuments1757450000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ── Ajustes e-CF ──────────────────────────────────────────────────
        await queryRunner.query(
            `ALTER TABLE "settings" ADD COLUMN "ecf_ambiente" varchar NOT NULL DEFAULT ('testecf')`,
        );
        await queryRunner.query(`ALTER TABLE "settings" ADD COLUMN "ecf_cert_path" varchar`);
        await queryRunner.query(`ALTER TABLE "settings" ADD COLUMN "ecf_cert_password" text`);

        // ── Comprobantes electrónicos ─────────────────────────────────────
        await queryRunner.query(`CREATE TABLE "ecf_documents" (
            "id" varchar PRIMARY KEY NOT NULL,
            "sale_id" varchar,
            "tipo" integer NOT NULL,
            "encf" varchar(13) NOT NULL,
            "via" varchar NOT NULL DEFAULT ('ecf'),
            "estado" varchar NOT NULL DEFAULT ('draft'),
            "rnc_emisor" varchar(11),
            "rnc_comprador" varchar(11),
            "nombre_comprador" varchar,
            "monto_total" decimal(10,2) NOT NULL DEFAULT (0),
            "itbis_total" decimal(10,2) NOT NULL DEFAULT (0),
            "fecha_emision" varchar(10),
            "codigo_seguridad" varchar(6),
            "signed_xml" text,
            "track_id" varchar,
            "dgii_code" integer,
            "dgii_estado" varchar,
            "dgii_mensajes" text,
            "last_error" text,
            "intentos" integer NOT NULL DEFAULT (0),
            "proximo_intento" datetime,
            "sent_at" datetime,
            "resolved_at" datetime,
            "created_at" datetime NOT NULL DEFAULT (datetime('now')),
            "updated_at" datetime NOT NULL DEFAULT (datetime('now'))
        )`);
        await queryRunner.query(
            `CREATE UNIQUE INDEX "IDX_ecf_documents_encf" ON "ecf_documents" ("encf")`,
        );
        await queryRunner.query(
            `CREATE INDEX "idx_ecf_documents_estado" ON "ecf_documents" ("estado")`,
        );
        await queryRunner.query(
            `CREATE INDEX "idx_ecf_documents_sale" ON "ecf_documents" ("sale_id")`,
        );

        // ── Retiro de la facturación antigua (ver comentario de la clase) ─
        await queryRunner.query(`DELETE FROM "ncf_sequences" WHERE "type" IN ('B01','B02','B04')`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Las secuencias B01/B02/B04 eliminadas no se recuperan: ya estaban
        // vencidas y eran incompatibles con el e-NCF.
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_ecf_documents_sale"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_ecf_documents_estado"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ecf_documents_encf"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "ecf_documents"`);
        await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "ecf_cert_password"`);
        await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "ecf_cert_path"`);
        await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "ecf_ambiente"`);
    }
}
