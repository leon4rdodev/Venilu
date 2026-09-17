import { MigrationInterface, QueryRunner } from "typeorm";

/** Licensing: clock high-water mark to detect a system date set back. */
export class LicenseClockGuard1756950000000 implements MigrationInterface {
    name = 'LicenseClockGuard1756950000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "settings" ADD COLUMN "license_last_seen_at" varchar`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "license_last_seen_at"`);
    }
}
