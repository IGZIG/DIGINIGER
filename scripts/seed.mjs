/**
 * Peuplement complet de la base de démonstration DIGINIGER :
 *   1. supabase/seed/seed.sql        (écoles, offres, formations, modules, leçons)
 *   2. supabase/seed/assessments.sql (exercices, examens, documents pédagogiques)
 *
 * Idempotent : les deux fichiers utilisent des insertions conditionnelles,
 * on peut donc rejouer `npm run seed` sans créer de doublons ni casser la base.
 *
 * Usage :
 *   SUPABASE_DB_PASSWORD=... node scripts/seed.mjs
 * ou, si .env.local contient déjà le mot de passe :
 *   node scripts/seed.mjs            (chargement automatique du .env.local)
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Chargement minimal de .env.local (aucune dépendance externe requise).
function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

loadEnvFile(join(ROOT, ".env.local"));
loadEnvFile(join(ROOT, ".env"));

const {
  SUPABASE_DB_HOST = "aws-0-eu-west-1.pooler.supabase.com",
  SUPABASE_DB_PORT = "5432",
  SUPABASE_DB_USER = "postgres.dthflsyrhhbpoiecajun",
  SUPABASE_DB_PASSWORD,
  SUPABASE_DB_NAME = "postgres",
} = process.env;

if (!SUPABASE_DB_PASSWORD) {
  console.error(
    "SUPABASE_DB_PASSWORD manquant.\n" +
      "Définissez-le dans .env.local ou passez-le en variable d'environnement.",
  );
  process.exit(1);
}

const client = new pg.Client({
  host: SUPABASE_DB_HOST,
  port: Number(SUPABASE_DB_PORT),
  user: SUPABASE_DB_USER,
  password: SUPABASE_DB_PASSWORD,
  database: SUPABASE_DB_NAME,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 120000,
});

const FILES = ["supabase/seed/seed.sql", "supabase/seed/assessments.sql"];

await client.connect();
console.log("→ Connecté à la base DIGINIGER");

// Un schéma non initialisé produirait des erreurs trompeuses : on vérifie.
const { rows: tables } = await client.query(
  "select count(*)::int as total from information_schema.tables where table_schema = 'public'",
);
if (tables[0].total < 20) {
  console.error(
    `Schéma incomplet (${tables[0].total} tables) : lancez d'abord node scripts/apply-migrations.mjs`,
  );
  await client.end();
  process.exit(1);
}

for (const relative of FILES) {
  const sql = readFileSync(join(ROOT, relative), "utf8");
  // Chaque fichier est joué dans une transaction : soit tout passe, soit rien.
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("commit");
    console.log(`✔ ${relative} appliqué`);
  } catch (error) {
    await client.query("rollback");
    console.error(`✘ ${relative} en échec : ${error.message}`);
    await client.end();
    process.exit(1);
  }
}

// Récapitulatif factuel de ce qui est réellement en base.
const summary = await client.query(`
  select
    (select count(*)::int from public.schools) as schools,
    (select count(*)::int from public.plans) as plans,
    (select count(*)::int from public.courses) as courses,
    (select count(*)::int from public.modules) as modules,
    (select count(*)::int from public.lessons) as lessons,
    (select count(*)::int from public.exercises) as exercises,
    (select count(*)::int from public.course_documents) as documents
`);

const s = summary.rows[0];
console.log(
  `\nBase de démonstration prête : ${s.schools} écoles, ${s.plans} offres, ${s.courses} formations, ` +
    `${s.modules} modules, ${s.lessons} leçons, ${s.exercises} évaluations, ${s.documents} documents RAG.`,
);
console.log("Comptes de démonstration : node scripts/seed-users.mjs");

await client.end();
