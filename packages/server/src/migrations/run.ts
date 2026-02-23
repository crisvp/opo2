/**
 * Migration runner — reads SQL files and executes them in order.
 * Usage: pnpm --filter server migrate
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
// SQL files live in migrations/ at the package root, two levels up from src/migrations/
const SQL_DIR = resolve(__dirname, "../../migrations");

const DATABASE_URL = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_ADMIN_URL or DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version     VARCHAR PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const migrations = ["001_initial_schema.sql", "002_add_two_factor_enabled.sql", "003_seed_catalog_assoc_types.sql", "004_widen_places_lsad.sql"];

    for (const migration of migrations) {
      const { rows } = await client.query(
        "SELECT version FROM schema_migrations WHERE version = $1",
        [migration],
      );

      if (rows.length > 0) {
        console.log(`  Skipping ${migration} (already applied)`);
        continue;
      }

      console.log(`  Applying ${migration}...`);
      const sql = readFileSync(resolve(SQL_DIR, migration), "utf8");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [migration]);
        await client.query("COMMIT");
        console.log(`  ✓ Applied ${migration}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }

    console.log("Migrations complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
