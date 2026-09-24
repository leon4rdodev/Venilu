import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Escala de interfaz (zoom tipo navegador), configurable en Ajustes → Apariencia.
 *
 * `settings.ui_scale` guarda el factor aplicado vía webContents.setZoomFactor
 * (1 = 100%, 1.25 = 125%…) para que la vista se mantenga entre sesiones.
 *
 * ADD COLUMN trivial en SQLite: los instaladores existentes ganan la columna
 * con DEFAULT 1 (100%) sin tocar sus datos.
 */
export class UIScale1757350000000 implements MigrationInterface {
    name = 'UIScale1757350000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "settings" ADD COLUMN "ui_scale" real NOT NULL DEFAULT 1`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "ui_scale"`);
    }
}