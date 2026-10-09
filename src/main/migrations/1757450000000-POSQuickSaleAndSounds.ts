import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Añade columnas para Venta Rápida y Sonidos POS a la tabla settings.
 *
 * quick_sale_enabled: Habilita el modo de "Venta rápida" en el POS.
 * quick_sale_payment_method: Método de pago por defecto para venta rápida.
 * sound_enabled: Sonidos en el POS activados/desactivados.
 * sound_volume: Volumen global de sonidos (0.0 - 1.0).
 * sound_add_product: Sonido al agregar producto al carrito.
 * sound_sale_complete: Sonido al completar venta.
 *
 * ADD COLUMN trivial en SQLite: los instaladores existentes ganan las columnas
 * con sus valores DEFAULT sin tocar sus datos.
 */
export class POSQuickSaleAndSounds1757450000000 implements MigrationInterface {
    name = 'POSQuickSaleAndSounds1757450000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "settings" ADD COLUMN "quick_sale_enabled" boolean NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "settings" ADD COLUMN "quick_sale_payment_method" text NOT NULL DEFAULT 'transfer'`);
        await queryRunner.query(`ALTER TABLE "settings" ADD COLUMN "sound_enabled" boolean NOT NULL DEFAULT 1`);
        await queryRunner.query(`ALTER TABLE "settings" ADD COLUMN "sound_volume" real NOT NULL DEFAULT 0.5`);
        await queryRunner.query(`ALTER TABLE "settings" ADD COLUMN "sound_add_product" boolean NOT NULL DEFAULT 1`);
        await queryRunner.query(`ALTER TABLE "settings" ADD COLUMN "sound_sale_complete" boolean NOT NULL DEFAULT 1`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "quick_sale_enabled"`);
        await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "quick_sale_payment_method"`);
        await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "sound_enabled"`);
        await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "sound_volume"`);
        await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "sound_add_product"`);
        await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "sound_sale_complete"`);
    }
}