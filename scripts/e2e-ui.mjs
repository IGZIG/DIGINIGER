/**
 * Vérification d'interface de bout en bout (sans navigateur) :
 *   1. connexion réelle des trois rôles via l'API Supabase Auth ;
 *   2. appel de chaque page clé avec la session (codes HTTP + marqueurs
 *      attendus dans le HTML rendu) ;
 *   3. exploration des liens internes trouvés dans le HTML pour détecter
 *      tout lien mort (404/500).
 *
 * Usage : node scripts/e2e-ui.mjs [--base http://127.0.0.1:3000]
 *
 * Le script échoue (code 1) au premier écart, ce qui permet de l'utiliser
 * comme test de non-régression avant déploiement.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

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

const baseArg = process.argv.indexOf("--base");
const BASE = baseArg > -1 ? process.argv[baseArg + 1] : "http://127.0.0.1:3000";
const PASSWORD = process.env.DEMO_PASSWORD || "Diginiger2026!";
const { default: ws } = await import("ws").catch(() => ({ default: undefined }));

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false }, ...(ws ? { realtime: { transport: ws } } : {}) },
);

async function cookieFor(email) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) throw new Error(`Connexion ${email} : ${error?.message}`);
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const key = `sb-${ref}-auth-token`;
  const encoded =
    "base64-" + Buffer.from(JSON.stringify(data.session), "utf8").toString("base64url");
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

/**
 * Requête unique avec une reprise : en développement, la première compilation
 * d'une route peut dépasser le délai et couper la connexion (le serveur reste
 * sain). On retente une fois avant de conclure à un échec.
 */
async function fetchOnce(path, cookie) {
  const response = await fetch(`${BASE}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
    signal: AbortSignal.timeout(180_000),
  });
  const body = response.status < 300 ? await response.text() : "";
  return { status: response.status, location: response.headers.get("location"), body };
}

async function get(path, cookie) {
  try {
    return await fetchOnce(path, cookie);
  } catch (error) {
    if (error.name === "TimeoutError") throw error;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return fetchOnce(path, cookie);
  }
}

/** Une page attendue : statut HTTP et fragments de HTML obligatoires. */
async function expectPage({ path, cookie, status, markers, label }) {
  const result = await get(path, cookie);
  const ok = result.status === status;
  const missing = ok && markers ? markers.filter((marker) => !result.body.includes(marker)) : [];
  check(
    `${label ?? path} → ${status}`,
    ok && missing.length === 0,
    ok ? (missing.length ? `marqueur absent : ${missing[0]}` : "") : `reçu ${result.status}`,
  );
  return result;
}

console.log(`\n=== 1. Pages publiques (sans session) — ${BASE}`);
for (const [path, marker] of [
  ["/", "DIGINIGER"],
  ["/formations", "Formations"],
  ["/ecoles", "écoles"],
  ["/tarifs", "FCFA"],
  ["/a-propos", "DIGINIGER"],
  ["/contact", "Contact"],
  ["/formateurs", "formateur"],
  ["/entreprises", "Entreprises"],
  ["/verifier-certificat", "certificat"],
  ["/tuteur-ia", "tuteur"],
  ["/confidentialite", "confidentialité"],
  ["/mentions-legales", "mentions"],
  ["/conditions-utilisation", "conditions"],
  ["/inscription", "inscription"],
  ["/connexion", "connexion"],
]) {
  await expectPage({ path, status: 200, markers: [marker] });
}

console.log("\n=== 2. Fiches dynamiques (écoles et formations publiées)");
const { data: schools } = await supabase.from("schools").select("slug").limit(6);
for (const school of schools ?? []) {
  await expectPage({ path: `/ecoles/${school.slug}`, status: 200, label: `/ecoles/${school.slug}` });
}
const { data: courses } = await supabase
  .from("courses")
  .select("slug")
  .eq("status", "published")
  .limit(3);
for (const course of courses ?? []) {
  await expectPage({ path: `/formations/${course.slug}`, status: 200 });
}

console.log("\n=== 2 bis. Bilinguisme FR / EN (cookie de langue)");
{
  const fr = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(60_000) }).then((r) => r.text());
  const enResponse = await fetch(`${BASE}/`, {
    headers: { cookie: "diginiger_locale=en" },
    signal: AbortSignal.timeout(60_000),
  });
  const en = await enResponse.text();
  check("version FR par défaut", fr.includes('lang="fr"') && fr.includes("Développez les compétences"));
  check(
    "version EN servie par le serveur",
    en.includes('lang="en"') && en.includes("Build the skills") && en.includes("Our schools"),
  );
  check("sélecteur de langue présent", fr.includes("Langue / Language"));
}

console.log("\n=== 3. Espaces protégés : refus des visiteurs anonymes");
for (const path of ["/app", "/formateur", "/admin"]) {
  const result = await get(path);
  check(
    `${path} sans session → 307 /connexion`,
    result.status === 307 && (result.location ?? "").includes("/connexion"),
    `reçu ${result.status} ${result.location ?? ""}`,
  );
}

console.log("\n=== 4. Espace apprenant");
const studentCookie = await cookieFor("etudiant.demo@diginiger.test");
for (const [path, marker] of [
  ["/app", "Bonjour"],
  ["/app/mes-formations", "formation"],
  ["/app/catalogue", "catalogue"],
  ["/app/progression", "progression"],
  ["/app/evaluations", "valuation"],
  ["/app/certificats", "ertificat"],
  ["/app/tuteur-ia", "uteur"],
  ["/app/profil", "rofil"],
  ["/app/abonnement", "abonnement"],
]) {
  await expectPage({ path, cookie: studentCookie, status: 200, markers: [marker] });
}

console.log("\n=== 5. Espace formateur (rôle formateur)");
const instructorCookie = await cookieFor("aissatou.demo@diginiger.test");
for (const [path, marker] of [
  ["/formateur", "Tableau de bord formateur"],
  ["/formateur/formations", "formation"],
  ["/formateur/generateur", "formation"],
  ["/formateur/evaluations", "valuation"],
  ["/formateur/apprenants", "pprenant"],
  ["/formateur/revenus", "FCFA"],
]) {
  await expectPage({ path, cookie: instructorCookie, status: 200, markers: [marker] });
}

console.log("\n=== 6. Espace administrateur (rôle admin)");
const adminCookie = await cookieFor("admin.demo@diginiger.test");
for (const [path, marker] of [
  ["/admin", "Apprenants"],
  ["/admin/formations", "Validation"],
  ["/admin/utilisateurs", "déterminent les droits"],
  ["/admin/demandes", "Demandes"],
  ["/admin/paiements", "Transactions"],
  ["/admin/contenus-ia", "générations"],
  ["/admin/certificats", "certificat"],
  ["/admin/parametres", "état de la plateforme"],
]) {
  await expectPage({ path, cookie: adminCookie, status: 200, markers: [marker] });
}

console.log("\n=== 7. Cloisonnement des rôles");
for (const path of ["/formateur", "/admin"]) {
  const result = await get(path, studentCookie);
  check(
    `apprenant ${path} → 307 refus`,
    result.status === 307 && (result.location ?? "").includes("acces-refuse"),
    `reçu ${result.status} ${result.location ?? ""}`,
  );
}
const adminInInstructor = await get("/formateur", adminCookie);
check("admin /formateur → 200 (supervision)", adminInInstructor.status === 200, `reçu ${adminInInstructor.status}`);
const instructorInAdmin = await get("/admin", instructorCookie);
check("formateur /admin → 307 refus", instructorInAdmin.status === 307, `reçu ${instructorInAdmin.status}`);

console.log("\n=== 8. Chasse aux liens morts (liens internes du HTML)");
const seeds = ["/", "/formations", "/ecoles", "/tarifs", "/app", "/formateur", "/admin"];
const cookiesBySeed = {
  "/app": studentCookie,
  "/formateur": instructorCookie,
  "/admin": adminCookie,
};
const found = new Set();
for (const seed of seeds) {
  const { body } = await get(seed, cookiesBySeed[seed]);
  for (const match of body.matchAll(/href="(\/[^"#?]*)"/g)) {
    const href = match[1];
    if (href.startsWith("/_next") || href.startsWith("/api")) continue;
    if (/\.(svg|png|jpg|jpeg|webp|ico|pdf|txt|xml)$/.test(href)) continue;
    found.add(href);
  }
}
const linkTargets = [...found].filter((href) => !href.startsWith("/auth/"));
console.log(`  ${linkTargets.length} liens internes distincts à vérifier`);

const broken = [];
const queue = [...linkTargets];
async function worker() {
  while (queue.length) {
    const href = queue.shift();
    const cookie = href.startsWith("/admin")
      ? adminCookie
      : href.startsWith("/formateur")
        ? instructorCookie
        : href.startsWith("/app")
          ? studentCookie
          : undefined;
    try {
      const result = await get(href, cookie);
      const ok = result.status === 200 || result.status === 307;
      if (!ok) broken.push(`${href} (${result.status})`);
    } catch (error) {
      broken.push(`${href} (${error.message})`);
    }
  }
}
await Promise.all(Array.from({ length: 5 }, worker));
check(
  `aucun lien mort parmi ${linkTargets.length} liens`,
  broken.length === 0,
  broken.slice(0, 8).join(", "),
);

console.log(`\n=== Résultat : ${passed} vérification(s) réussie(s), ${failures.length} échec(s)`);
if (failures.length) {
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
