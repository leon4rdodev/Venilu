import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Inyecciones de capital a la caja (aportes de efectivo a mitad de
 * turno). SUMAN al efectivo esperado del arqueo, a diferencia de
 * shift_expenses, que resta.
 */
export class ShiftCapital1757250000000 implements MigrationInterface {
    name = 'ShiftCapital1757250000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "shift_capital" ("id" varchar PRIMARY KEY NOT NULL, "shift_id" varchar NOT NULL, "amount" decimal(10,2) NOT NULL, "reason" varchar, "created_at" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_shift_capital_shift" FOREIGN KEY ("shift_id") REFERENCES "shifts" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`CREATE INDEX "idx_shift_capital_shift" ON "shift_capital" ("shift_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_shift_capital_shift"`);
        await queryRunner.query(`DROP TABLE "shift_capital"`);
    }
}
