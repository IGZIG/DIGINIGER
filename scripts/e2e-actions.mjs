/**
 * Vérifie que les écritures réelles fonctionnent (pas seulement l'affichage) :
 * Server Actions « admin » pilotées via le protocole Next (POST + en-têtes
 * `Next-Action`), avec la session d'un compte de démonstration.
 *
 * Chaque action est testée en aller-retour complet : appel HTTP → exécution
 * serveur → relecture en base PostgreSQL (via `pg`).
 *
 * Usage :
 *   SUPABASE_DB_PASSWORD=... node scripts/e2e-actions.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, raw] = match;
    if (!process.env[key]) process.env[key] = raw.replace(/^["']|["']$/g, "");
  }
}
loadEnvFile(join(ROOT, ".env.local"));

const BASE = process.env.E2E_BASE ?? "http://127.0.0.1:3000";
const PASSWORD = process.env.DEMO_PASSWORD || "Diginiger2026!";
const { default: ws } = await import("ws").catch(() => ({ default: undefined }));

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false }, ...(ws ? { realtime: { transport: ws } } : {}) },
);

const db = new pg.Client({
  host: process.env.SUPABASE_DB_HOST ?? "aws-0-eu-west-1.pooler.supabase.com",
  user: process.env.SUPABASE_DB_USER ?? "postgres.dthflsyrhhbpoiecajun",
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME ?? "postgres",
  ssl: { rejectUnauthorized: false },
});
if (!process.env.SUPABASE_DB_PASSWORD) {
  console.error("SUPABASE_DB_PASSWORD manquant : nécessaire pour relire l'état en base.");
  process.exit(1);
}
await db.connect();

async function cookieFor(email) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) throw new Error(`Connexion ${email} : ${error?.message}`);
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const key = `sb-${ref}-auth-token`;
  const encoded = "base64-" + Buffer.from(JSON.stringify(data.session), "utf8").toString("base64url");
  const CHUNK = 3180;
  if (encoded.length <= CHUNK) return `${key}=${encoded}`;
  const parts = [];
  for (let i = 0, index = 0; i < encoded.length; i += CHUNK, index += 1) {
    parts.push(`${key}.${index}=${encoded.slice(i, i + CHUNK)}`);
  }
  return parts.join("; ");
}

let passed = 0;
const failures = [];
function check(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ✔ ${label}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ✘ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Rejoue une Server Action identifiée par son nom exporté (encodage Next). */
async function callAction(actionName, args, cookie) {
  const id = await actionId(actionName);
  const response = await fetch(`${BASE}${actionPage(actionName)}`, {
    method: "POST",
    headers: {
      cookie,
      "next-action": id,
      "content-type": "text/plain;charset=UTF-8",
      "next-router-state-tree": encodeURIComponent(JSON.stringify(["", {}, null, null, true])),
    },
    body: JSON.stringify(args),
    redirect: "manual",
  });
  const text = await response.text();
  return { status: response.status, text };
}

import { readFileSync as read, readdirSync } from "node:fs";

/**
 * Les identifiants d'action sont des hachages générés au build. On les
 * retrouve en lisant les chunks serveur : `createServerReference("<id>", ...,
 * "<nomExporté>")`. Aucune valeur n'est codée en dur.
 */
let actionCache = null;
function actionIndex() {
  if (actionCache) return actionCache;
  actionCache = new Map();
  const chunkDir = join(ROOT, ".next", "server", "chunks");
  for (const file of readdirSync(chunkDir)) {
    if (!file.endsWith(".js")) continue;
    const source = read(join(chunkDir, file), "utf8");
    // Les chunks serveur échappent les guillemets : on tolère `"` et `\"`.
    const pattern = /createServerReference\)\(\\?"([0-9a-f]{40,})\\?"[\s\S]{0,220}?\\?"([a-zA-Z][a-zA-Z0-9]*)\\?"\)/g;
    for (const match of source.matchAll(pattern)) {
      actionCache.set(match[2], match[1]);
    }
  }
  return actionCache;
}

async function actionId(name) {
  const id = actionIndex().get(name);
  if (!id) throw new Error(`Identifiant d'action introuvable pour ${name}`);
  return id;
}

function actionPage() {
  return "/admin/formations";
}

console.log(`\n=== 1. Connexions et préparation (${BASE})`);
const adminCookie = await cookieFor("admin.demo@diginiger.test");
const instructorCookie = await cookieFor("aissatou.demo@diginiger.test");
const studentCookie = await cookieFor("etudiant.demo@diginiger.test");
check("sessions admin / formateur / apprenant", Boolean(adminCookie && instructorCookie && studentCookie));

console.log("\n=== 2. Refus des actions réservées à l'administration");
for (const [name, cookie] of [
  ["reviewCourseAction", studentCookie],
  ["reviewCourseAction", instructorCookie],
]) {
  const target = (await db.query("select id from courses limit 1")).rows[0].id;
  const result = await callAction(name, [target, "archive"], cookie);
  const published = (await db.query("select status, published_at from courses where id=$1", [target])).rows[0];
  check(
    `${name.split('A')[0]} refusée pour un non-admin`,
    published.status !== "archived",
    `statut inchangé attendu, reçu ${published.status} (HTTP ${result.status})`,
  );
}

console.log("\n=== 3. Validation éditoriale réelle par l'administration");

// b. Cas positif : une formation en revue, avec leçons, est publiée par l'admin.
const source = (await db.query("select * from courses where slug = 'ia-generative-pratique'")).rows[0];
const draft = await db.query(
  "insert into courses (slug, title_fr, subtitle_fr, description_fr, instructor_id, school_id, level, status, price_xof, is_free, duration_hours) " +
    "values ('e2e-validation-admin', 'E2E — validation', 'test', 'test', $1, $2, 'debutant', 'in_review', 0, true, 1) returning id",
  [source.instructor_id, source.school_id],
);
const draftId = draft.rows[0].id;
const sourceModule = (await db.query("select * from modules where course_id=$1 limit 1", [source.id])).rows[0];
const newModule = await db.query(
  "insert into modules (course_id, title_fr, position) values ($1, 'Module E2E', 1) returning id",
  [draftId],
);
await db.query(
  "insert into lessons (module_id, title_fr, kind, duration_min, position) values ($1, 'Leçon E2E', 'reading', 10, 1)",
  [newModule.rows[0].id],
);
void sourceModule;

const publishCall = await callAction("reviewCourseAction", [draftId, "publish"], adminCookie);
const published = (await db.query("select status, published_at from courses where id=$1", [draftId])).rows[0];
check(
  "l'admin publie réellement une formation complète",
  publishCall.status === 200 && published.status === "published" && published.published_at !== null,
  `statut ${published.status}, HTTP ${publishCall.status}`,
);

const assessmentsCall = await callAction("publishCourseAssessmentsAction", [draftId], adminCookie);
check(
  "publication des évaluations de la formation",
  assessmentsCall.status === 200,
  `HTTP ${assessmentsCall.status}`,
);

// c. Changement de rôle réel + protection contre l'auto-rétrogradation.
const target = (await db.query("select id, role from profiles where email = 'etudiant2.demo@diginiger.test'")).rows[0];
const roleCall = await callAction("updateUserRoleAction", [target.id, "instructor"], adminCookie);
const roleAfter = (await db.query("select role from profiles where id=$1", [target.id])).rows[0].role;
check("l'admin change réellement un rôle", roleCall.status === 200 && roleAfter === "instructor", `rôle ${roleAfter}`);

const adminId = (await db.query("select id from profiles where email = 'admin.demo@diginiger.test'")).rows[0].id;
await callAction("updateUserRoleAction", [adminId, "student"], adminCookie);
const selfRole = (await db.query("select role from profiles where id=$1", [adminId])).rows[0].role;
check("auto-rétrogradation de l'admin impossible", selfRole === "admin", `rôle ${selfRole}`);

// d. Révocation de certificat réelle.
const certificate = (await db.query("select id, serial from certificates where revoked_at is null limit 1")).rows[0];
if (certificate) {
  const revokeCall = await callAction("revokeCertificateAction", [certificate.id, "Test E2E : vérification de la révocation"], adminCookie);
  const revoked = (await db.query("select revoked_at from certificates where id=$1", [certificate.id])).rows[0].revoked_at;
  check("révocation de certificat effective", revokeCall.status === 200 && revoked !== null);
  await db.query("update certificates set revoked_at=null, revoke_reason=null where id=$1", [certificate.id]);
} else {
  check("révocation de certificat effective", false, "aucun certificat en base");
}

// Nettoyage : on remet la base dans son état de démonstration.
await db.query("delete from courses where id=$1", [draftId]);
await db.query("update profiles set role='student' where id=$1", [target.id]);
// a. Une formation sans leçon ne peut pas être publiée.
const emptyCourse = await db.query(
  "insert into courses (slug, title_fr, instructor_id, status, price_xof, is_free, school_id) " +
    "select 'e2e-sans-lecon', 'E2E — sans leçon', instructor_id, 'in_review', 0, true, school_id " +
    "from courses where slug = 'ia-generative-pratique' returning id",
);
const emptyId = emptyCourse.rows[0].id;
await callAction("reviewCourseAction", [emptyId, "publish"], adminCookie);
const emptyAfter = (await db.query("select status from courses where id=$1", [emptyId])).rows[0].status;
check("publication bloquée si la formation n'a aucune leçon", emptyAfter !== "published", `statut ${emptyAfter}`);
await db.query("delete from courses where id=$1", [emptyId]);

console.log(`\n=== Résultat : ${passed} réussie(s), ${failures.length} échec(s)`);
await db.end();
if (failures.length) {
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
