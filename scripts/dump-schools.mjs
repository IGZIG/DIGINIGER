/**
 * Exporte les écoles (nom, slogan, couleur, directeur) dans un fichier JSON,
 * pour que les scripts non-Node (ex. génération Word) puissent les relire
 * sans dépendance à PostgreSQL.
 *
 * Usage : node scripts/dump-schools.mjs [chemin-du-json]
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = process.argv[2] ?? join(ROOT, "scripts/.tmp/schools.json");

for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}

const db = new pg.Client({
  host: process.env.SUPABASE_DB_HOST ?? "aws-0-eu-west-1.pooler.supabase.com",
  port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
  user: process.env.SUPABASE_DB_USER ?? "postgres.dthflsyrhhbpoiecajun",
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME ?? "postgres",
  ssl: { rejectUnauthorized: false },
});

await db.connect();
const { rows } = await db.query(
  `select s.slug, s.name_fr, s.tagline_fr, s.accent, s.director_name, s.director_role,
          (select c.title_fr from public.courses c
            where c.school_id = s.id and c.status = 'published'
            order by c.created_at limit 1) as course_title
     from public.schools s
    where s.is_active
    order by s.position`,
);
await db.end();

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(rows, null, 2), "utf8");
console.log(`${rows.length} écoles exportées → ${OUT}`);
