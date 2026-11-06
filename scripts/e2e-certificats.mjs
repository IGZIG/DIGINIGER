/**
 * Certificats par école — vérification de bout en bout.
 *
 * Contrôle que chaque certificat porte bien l'identité de son école
 * (nom, slogan, couleur, directeur) et que le téléchargement reste réservé
 * au titulaire et à l'administration.
 *
 * Usage : node scripts/e2e-certificats.mjs [--base http://127.0.0.1:3000]
 */
import { readFileSync, existsSync } from "node:fs";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}

const baseArg = process.argv.indexOf("--base");
const BASE = baseArg > -1 ? process.argv[baseArg + 1] : "http://127.0.0.1:3000";
const PASSWORD = process.env.DEMO_PASSWORD || "Diginiger2026!";

const { default: ws } = await import("ws").catch(() => ({ default: undefined }));
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false }, ...(ws ? { realtime: { transport: ws } } : {}) },
);

const db = new pg.Client({
  host: process.env.SUPABASE_DB_HOST ?? "aws-0-eu-west-1.pooler.supabase.com",
  port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
  user: process.env.SUPABASE_DB_USER ?? "postgres.dthflsyrhhbpoiecajun",
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME ?? "postgres",
  ssl: { rejectUnauthorized: false },
});

let passed = 0;
let failed = 0;
function check(label, ok, detail) {
  if (ok) {
    passed += 1;
    console.log(`  ✔ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✘ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function cookieFor(email) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) throw new Error(`Connexion ${email} : ${error?.message}`);
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const encoded = "base64-" + Buffer.from(JSON.stringify(data.session), "utf8").toString("base64url");
  return `sb-${ref}-auth-token=${encoded}`;
}

/** Tous les noms de formateurs, pour vérifier qu'aucun n'est imprimé. */
async function instructorNames() {
  const { rows } = await db.query(
    `select full_name from public.profiles where role = 'instructor' and full_name is not null`,
  );
  return rows.map((row) => row.full_name);
}

/** Relit le texte d'un PDF (ghostscript) pour vérifier ce qui est imprimé. */
function pdfText(bytes) {
  const file = "/tmp/certificat-verif.pdf";
  writeFileSync(file, Buffer.from(bytes));
  return execFileSync("gs", [
    "-q", "-dNOPAUSE", "-dBATCH", "-sDEVICE=txtwrite", "-sOutputFile=-", file,
  ]).toString("utf8");
}

try {
  await db.connect();

  console.log("\n=== 1. Identité de l'école en base");
  const { rows: schools } = await db.query(
    `select id, slug, name_fr, accent, director_name, director_role from public.schools where is_active order by position`,
  );
  check("les 6 écoles sont présentes", schools.length >= 6, `${schools.length} écoles`);
  check(
    "aucun nom de responsable n'est enregistré",
    schools.every((s) => !s.director_name),
    schools.filter((s) => s.director_name).map((s) => s.slug).join(", "),
  );
  check(
    "chaque école garde son rôle de responsable",
    schools.every((s) => Boolean(s.director_role)),
  );
  check(
    "chaque école a sa couleur",
    schools.every((s) => /^#[0-9A-Fa-f]{6}$/.test(s.accent ?? "")),
  );
  const accents = new Set(schools.map((s) => s.accent));
  check("les couleurs sont distinctes", accents.size === schools.length, `${accents.size} couleurs`);

  const { rows: certs } = await db.query(
    `select c.serial, c.student_name, c.course_title, c.school_name, c.school_tagline,
            c.school_accent, c.director_name, c.director_role, p.email, c.revoked_at
       from public.certificates c
       join public.profiles p on p.id = c.user_id
      where c.revoked_at is null
      limit 3`,
  );
  check("au moins un certificat à vérifier", certs.length > 0);
  const cert = certs[0];
  check(
    "le certificat existant porte son école",
    Boolean(cert.school_name && cert.school_accent && cert.director_role),
    `${cert.school_name ?? "—"} / ${cert.director_role ?? "—"}`,
  );

  console.log("\n=== 2. Téléchargement : qui a le droit ?");
  const ownerCookie = await cookieFor(cert.email);
  const adminEmail = (await db.query(`select email from public.profiles where role='admin' limit 1`)).rows[0].email;
  const adminCookie = await cookieFor(adminEmail);
  const otherEmail = (
    await db.query(
      `select email from public.profiles
        where role='student' and email like '%@diginiger.test' and email <> $1
        order by email limit 1`,
      [cert.email],
    )
  ).rows[0].email;
  const otherCookie = await cookieFor(otherEmail);

  const url = `${BASE}/api/certificates/${cert.serial}/pdf`;

  const anon = await fetch(url, { redirect: "manual" });
  check("un visiteur non connecté est refusé", anon.status === 401, `HTTP ${anon.status}`);

  const stranger = await fetch(url, { headers: { cookie: otherCookie }, redirect: "manual" });
  check("un autre apprenant est refusé", stranger.status === 403, `HTTP ${stranger.status}`);

  const owner = await fetch(url, { headers: { cookie: ownerCookie }, redirect: "manual" });
  check("le titulaire télécharge son certificat", owner.status === 200, `HTTP ${owner.status}`);
  check(
    "la réponse est bien un PDF",
    (owner.headers.get("content-type") ?? "").includes("application/pdf"),
    owner.headers.get("content-type") ?? "—",
  );
  check(
    "le fichier est proposé au téléchargement",
    (owner.headers.get("content-disposition") ?? "").includes(`certificat-${cert.serial}.pdf`),
  );

  const asAdmin = await fetch(url, { headers: { cookie: adminCookie }, redirect: "manual" });
  check("l'administrateur télécharge aussi", asAdmin.status === 200, `HTTP ${asAdmin.status}`);

  console.log("\n=== 3. Contenu du PDF");
  const bytes = Buffer.from(await owner.arrayBuffer());
  check("le PDF n'est pas vide", bytes.length > 3000, `${bytes.length} octets`);
  check("c'est un fichier PDF valide", bytes.subarray(0, 5).toString() === "%PDF-");

  const text = pdfText(bytes);
  check("le nom de l'école figure sur le certificat", text.includes(cert.school_name));
  check(
    "le rôle du responsable figure sur le certificat",
    /Le Directeur|La Directrice|Directeur|Directrice/.test(text),
  );
  check("il reste une ligne à signer", /Signature/.test(text));
  check(
    "AUCUN nom de formateur ni de directeur n'est imprimé",
    ![cert.director_name, ...(await instructorNames())].filter(Boolean).some((name) => text.includes(name)),
    cert.director_name ?? "—",
  );
  check("le slogan de l'école figure sur le certificat", text.includes((cert.school_tagline ?? "").slice(0, 20)));
  check("le nom de l'apprenant figure sur le certificat", text.includes(cert.student_name));
  check("l'intitulé de la formation figure sur le certificat", text.includes(cert.course_title.slice(0, 25)));
  check("le numéro de série figure sur le certificat", text.includes(cert.serial));
  check("la mention « CERTIFICAT DE RÉUSSITE » est présente", /CERTIFICAT DE RÉUSSITE/.test(text));
  check("DIGINIGER reste mentionné comme plateforme", /DIGINIGER/.test(text));
  check("la maquette n'est pas marquée SPÉCIMEN", !/SPÉCIMEN/.test(text));

  console.log("\n=== 4. Une émission future porte l'école (RPC)");
  const { rows: rpc } = await db.query(
    `select pg_get_functiondef(oid) as def from pg_proc where proname = 'issue_certificate'`,
  );
  check(
    "la fonction d'émission enregistre l'école",
    (rpc[0]?.def ?? "").includes("school_name"),
  );
  check(
    "la fonction d'émission n'enregistre plus aucun nom",
    !(rpc[0]?.def ?? "").includes("v_school.director_name"),
  );
  check(
    "la fonction d'émission enregistre le rôle du responsable",
    (rpc[0]?.def ?? "").includes("director_role"),
  );

  const { rows: stored } = await db.query(
    `select count(*)::int total,
            count(director_name)::int with_name
       from public.certificates`,
  );
  check(
    "aucun nom enregistré avec les certificats",
    stored[0].with_name === 0,
    `${stored[0].with_name}/${stored[0].total}`,
  );
  const { rows: schoolNames } = await db.query(
    `select count(director_name)::int with_name from public.schools`,
  );
  check("aucun nom enregistré pour les écoles", schoolNames[0].with_name === 0);

  console.log("\n=== 5. Maquettes générées");
  const { existsSync: exists } = await import("node:fs");
  for (const school of schools) {
    const file = `/home/user/certificats-modeles/certificat-modele-${school.slug}.pdf`;
    check(`maquette « ${school.name_fr} »`, exists(file));
  }
  check(
    "recueil des 6 maquettes",
    exists("/home/user/certificats-modeles/tous-les-modeles.pdf"),
  );
} catch (error) {
  failed += 1;
  console.log(`\n✘ Erreur inattendue : ${error.message}`);
} finally {
  await db.end().catch(() => {});
  console.log(`\n=== Résultat : ${passed} réussie(s), ${failed} échec(s)`);
  process.exit(failed === 0 ? 0 : 1);
}
