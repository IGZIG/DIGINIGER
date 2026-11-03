/**
 * Applique les migrations SQL dans l'ordre, puis enregistre chaque version
 * dans supabase_migrations.schema_migrations (compatible Supabase CLI).
 *
 * Usage : node scripts/apply-migrations.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");

const {
  SUPABASE_DB_HOST = "aws-0-eu-west-1.pooler.supabase.com",
  SUPABASE_DB_PORT = "5432",
  SUPABASE_DB_USER = "postgres.dthflsyrhhbpoiecajun",
  SUPABASE_DB_PASSWORD,
  SUPABASE_DB_NAME = "postgres",
} = process.env;

if (!SUPABASE_DB_PASSWORD) {
  console.error("SUPABASE_DB_PASSWORD manquant");
  process.exit(1);
}

const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();

const client = new pg.Client({
  host: SUPABASE_DB_HOST,
  port: Number(SUPABASE_DB_PORT),
  user: SUPABASE_DB_USER,
  password: SUPABASE_DB_PASSWORD,
  database: SUPABASE_DB_NAME,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 120000,
});

await client.connect();
await client.query(`
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (
    version text primary key,
    name text,
    applied_at timestamptz not null default now()
  );
`);

for (const file of files) {
  const version = file.split("_")[0];
  const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
  process.stdout.write(`→ ${file} … `);
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query(
      `insert into supabase_migrations.schema_migrations (version, name)
       values ($1, $2) on conflict (version) do update set applied_at = now()`,
      [version, file],
    );
    await client.query("commit");
    console.log("OK");
  } catch (error) {
    await client.query("rollback");
    console.log("ÉCHEC");
    console.error(`\n${file}: ${error.message}`);
    if (error.position) console.error(`position ${error.position}`);
    await client.end();
    process.exit(1);
  }
}

const { rows } = await client.query(
  "select count(*)::int as n from information_schema.tables where table_schema = 'public'",
);
console.log(`\n${rows[0].n} tables publiques en place.`);
await client.end();
