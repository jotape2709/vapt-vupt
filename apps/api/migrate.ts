import { readFile } from "node:fs/promises";
import { Pool } from "pg";
const connectionString = process.env.MIGRATION_DATABASE_URL;
if (!connectionString)
  throw new Error("Defina MIGRATION_DATABASE_URL com a conta de migração.");
const pool = new Pool({ connectionString });
const db = await pool.connect();
try {
  await db.query("BEGIN");
  await db.query("SELECT pg_advisory_xact_lock(7102401)");
  await db.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const [version, file] of [
    ["001", "001_core.sql"],
    ["002", "002_identity_directory.sql"],
  ]) {
    const exists = await db.query(
      "SELECT version FROM schema_migrations WHERE version=$1",
      [version],
    );
    if (!exists.rowCount) {
      await db.query(
        await readFile(
          new URL("../../db/migrations/" + file, import.meta.url),
          "utf8",
        ),
      );
      await db.query("INSERT INTO schema_migrations(version) VALUES($1)", [
        version,
      ]);
    }
  }
  await db.query("COMMIT");
  console.info("Migrations 001–002 aplicadas ou já presentes.");
} catch (e) {
  await db.query("ROLLBACK");
  throw e;
} finally {
  db.release();
  await pool.end();
}
