/**
 * Génère un certificat MODÈLE par école.
 *
 * Ces PDF ne sont pas enregistrés en base : ce sont des maquettes à valider,
 * marquées « SPÉCIMEN ». Ils servent à montrer à quoi ressemblera le vrai
 * certificat remis à un apprenant de chaque école.
 *
 * Les données (nom de l'école, slogan, couleur, directeur, intitulé de la
 * formation) sont lues dans la base : aucun texte n'est inventé ici.
 *
 * Usage : node scripts/generate-school-certificates.mjs
 * Prérequis : npm run build:cert-pdf  (compilation du générateur)
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { PDFDocument } from "pdf-lib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = "/home/user/certificats-modeles";

for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}

// Les maquettes doivent être scannables depuis n'importe où : on garde
// l'adresse publique, jamais « localhost ».
const rawSite = process.env.NEXT_PUBLIC_SITE_URL ?? "";
const SITE = rawSite.includes("localhost") || rawSite.includes("127.0.0.1") || !rawSite
  ? "https://diginiger.vercel.app"
  : rawSite;
/** Apprenant fictif : identifie clairement la maquette. */
const DEMO_STUDENT = "Amina Issoufou";

const { buildCertificatePdf } = await import(join(ROOT, "scripts/.tmp/cert-pdf.mjs"));

const db = new pg.Client({
  host: process.env.SUPABASE_DB_HOST ?? "aws-0-eu-west-1.pooler.supabase.com",
  port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
  user: process.env.SUPABASE_DB_USER ?? "postgres.dthflsyrhhbpoiecajun",
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME ?? "postgres",
  ssl: { rejectUnauthorized: false },
});
await db.connect();

// Une école → une formation publiée (celle qui apparaîtra sur le modèle).
const { rows: schools } = await db.query(
  `select s.id, s.slug, s.name_fr, s.tagline_fr, s.accent, s.director_name, s.director_role,
          (select c.title_fr from public.courses c
            where c.school_id = s.id and c.status = 'published'
            order by c.created_at limit 1) as course_title
     from public.schools s
    where s.is_active
    order by s.position`,
);

if (schools.length === 0) {
  console.error("Aucune école active en base.");
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
const merged = await PDFDocument.create();
const produced = [];

for (const school of schools) {
  const serial = `DIGI-${new Date().getFullYear()}-EXEMPLE`;
  const bytes = await buildCertificatePdf({
    serial,
    studentName: DEMO_STUDENT,
    courseTitle: school.course_title ?? "Formation professionnalisante",
    issuedAt: new Date(),
    score: 82,
    verificationUrl: `${SITE}/verifier-certificat`,
    school: {
      name: school.name_fr,
      tagline: school.tagline_fr,
      accent: school.accent,
      directorName: school.director_name,
      directorRole: school.director_role,
    },
    specimen: true,
  });

  const file = join(OUT, `certificat-modele-${school.slug}.pdf`);
  writeFileSync(file, Buffer.from(bytes));

  // Le recueil : toutes les maquettes à la suite.
  const copy = await PDFDocument.load(bytes);
  const [page] = await merged.copyPages(copy, [0]);
  merged.addPage(page);

  produced.push({ file, name: school.name_fr, accent: school.accent });
  console.log(`  ✔ ${school.name_fr} (${school.accent}) → ${file}`);
}

const mergedFile = join(OUT, "tous-les-modeles.pdf");
writeFileSync(mergedFile, Buffer.from(await merged.save()));
console.log(`\n${produced.length} modèles générés dans ${OUT}`);
console.log(`Recueil : ${mergedFile}`);

await db.end();
