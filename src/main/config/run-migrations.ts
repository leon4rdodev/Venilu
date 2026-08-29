import { AppDataSource } from "./data-source";
import { InitialSchema1756150000000 } from "@main/migrations/1756150000000-InitialSchema";

/**
 * Runs pending migrations, BASELINING databases that predate the migration
 * system: installs built by the old `synchronize: true` mode already have the
 * full schema, so the initial migration is marked as applied without being
 * executed (running it would fail on the existing tables).
 *
 * Fresh installs have neither tables nor a migrations table — they fall
 * through to runMigrations(), which builds the schema from scratch.
 */
export async function runMigrationsWithBaseline(): Promise<void> {
    const schemaExists = await AppDataSource.query(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'products'`,
    );

    if (schemaExists.length > 0) {
        // Same table TypeORM creates for its migration bookkeeping
        await AppDataSource.query(
            `CREATE TABLE IF NOT EXISTS "migrations" (` +
            `"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, ` +
            `"timestamp" bigint NOT NULL, ` +
            `"name" varchar NOT NULL)`,
        );

        const initial = new InitialSchema1756150000000();
        const applied = await AppDataSource.query(
            `SELECT 1 FROM "migrations" WHERE "name" = ?`,
            [initial.name],
        );
        if (applied.length === 0) {
            await AppDataSource.query(
                `INSERT INTO "migrations" ("timestamp", "name") VALUES (?, ?)`,
                [1756150000000, initial.name],
            );
            console.log('[Migrations] Existing schema baselined as', initial.name);
        }
    }

    const executed = await AppDataSource.runMigrations();
    if (executed.length > 0) {
        console.log('[Migrations] Applied:', executed.map(m => m.name).join(', '));
    }
}
