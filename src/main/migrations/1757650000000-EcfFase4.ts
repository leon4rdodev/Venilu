import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Fase 4 de facturación electrónica (e-CF): Representación Impresa,
 * contingencia y anulación de rangos. Ver `docs/fec/REQUISITOS.md` §4.18–§4.20.
 *
 *   - Ajustes del emisor que la Representación Impresa debe mostrar
 *     (Informe Técnico §18.2.1-B): nombre comercial, municipio y provincia
 *     (códigos de `ProvinciaMunicipioType` del XSD oficial).
 *   - `ecf_contingencias`: períodos de contingencia por imposibilidad técnica
 *     (Informe Técnico §19.2). `hasta IS NULL` = contingencia en curso.
 *   - `ecf_documents`: el e-CF de reemplazo guarda el NCF no electrónico que
 *     reemplaza (`InformacionReferencia`, código de modificación 4).
 *   - `ecf_anulaciones`: cada solicitud ANECF enviada a la DGII.
 *
 * Solo ADD COLUMN / CREATE TABLE: los datos existentes no se tocan.
 */
export class EcfFase41757650000000 implements MigrationInterface {
    name = 'EcfFase41757650000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "settings" ADD COLUMN "ecf_nombre_comercial" varchar`);
        await queryRunner.query(`ALTER TABLE "settings" ADD COLUMN "ecf_municipio" varchar(6)`);
        await queryRunner.query(`ALTER TABLE "settings" ADD COLUMN "ecf_provincia" varchar(6)`);

        await queryRunner.query(`ALTER TABLE "ecf_documents" ADD COLUMN "ncf_reemplazado" varchar(19)`);
        await queryRunner.query(`ALTER TABLE "ecf_documents" ADD COLUMN "fecha_ncf_reemplazado" varchar(10)`);

        await queryRunner.query(`CREATE TABLE "ecf_anulaciones" (
            "id" varchar PRIMARY KEY NOT NULL,
            "tipo" integer NOT NULL,
            "desde" varchar(13) NOT NULL,
            "hasta" varchar(13) NOT NULL,
            "cantidad" integer NOT NULL,
            "estado" varchar NOT NULL DEFAULT ('pendiente'),
            "ambiente" varchar NOT NULL,
            "signed_xml" text,
            "dgii_codigo" varchar,
            "dgii_nombre" varchar,
            "dgii_mensajes" text,
            "last_error" text,
            "username" varchar,
            "created_at" datetime NOT NULL DEFAULT (datetime('now')),
            "updated_at" datetime NOT NULL DEFAULT (datetime('now'))
        )`);
        await queryRunner.query(
            `CREATE INDEX "idx_ecf_anulaciones_tipo" ON "ecf_anulaciones" ("tipo")`,
        );

        await queryRunner.query(`CREATE TABLE "ecf_contingencias" (
            "id" varchar PRIMARY KEY NOT NULL,
            "desde" datetime NOT NULL,
            "hasta" datetime,
            "motivo" text NOT NULL,
            "motivo_fin" text,
            "username" varchar,
            "created_at" datetime NOT NULL DEFAULT (datetime('now')),
            "updated_at" datetime NOT NULL DEFAULT (datetime('now'))
        )`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "ecf_contingencias"`);
        await queryRunner.query(`DROP INDEX "idx_ecf_anulaciones_tipo"`);
        await queryRunner.query(`DROP TABLE "ecf_anulaciones"`);
        await queryRunner.query(`ALTER TABLE "ecf_documents" DROP COLUMN "fecha_ncf_reemplazado"`);
        await queryRunner.query(`ALTER TABLE "ecf_documents" DROP COLUMN "ncf_reemplazado"`);
        await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "ecf_provincia"`);
        await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "ecf_municipio"`);
        await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "ecf_nombre_comercial"`);
    }
}
