import { MigrationInterface, QueryRunner } from "typeorm";

/** Licensing: anchors the free-trial start date in the database. */
export class LicenseTrial1756350000000 implements MigrationInterface {
    name = 'LicenseTrial1756350000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "settings" ADD COLUMN "trial_started_at" varchar`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "trial_started_at"`);
    }
}
