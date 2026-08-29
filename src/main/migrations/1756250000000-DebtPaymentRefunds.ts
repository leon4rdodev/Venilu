import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Refund support on debt_payments: voiding a credit sale that was already
 * (partially) collected now records a 'refund' row that reverses the income
 * and the register's expected cash.
 *   - type:      'payment' (default) | 'refund'
 *   - reference: sale id the refund belongs to
 */
export class DebtPaymentRefunds1756250000000 implements MigrationInterface {
    name = 'DebtPaymentRefunds1756250000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "debt_payments" ADD COLUMN "type" varchar NOT NULL DEFAULT ('payment')`);
        await queryRunner.query(`ALTER TABLE "debt_payments" ADD COLUMN "reference" varchar`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "debt_payments" DROP COLUMN "reference"`);
        await queryRunner.query(`ALTER TABLE "debt_payments" DROP COLUMN "type"`);
    }
}
