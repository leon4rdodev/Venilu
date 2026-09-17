import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Fecha de anulación de la venta: la Nota de Crédito B04 del reporte 607
 * debe llevar la fecha en que se emitió (anulación), no la de la venta.
 */
export class SaleVoidedAt1756750000000 implements MigrationInterface {
    name = 'SaleVoidedAt1756750000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sales" ADD COLUMN "voided_at" datetime`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN "voided_at"`);
    }
}
