/**
 * Diagnostic de configuration — à lancer AVANT de coller vos clés.
 * ---------------------------------------------------------------------------
 * Ne se connecte à rien, ne dépense rien : il lit simplement .env.local et
 * dit, variable par variable, ce qui est présent, ce qui manque et quoi faire.
 *
 * Usage :
 *   node scripts/env-doctor.mjs
 *   node scripts/env-doctor.mjs --template   # affiche le bloc à compléter
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ENV_PATH = join(ROOT, ".env.local");

if (!existsSync(ENV_PATH)) {
  console.error(
    `❌ Aucun fichier .env.local dans ${ROOT}.\n` +
      "   Créez-le à partir de .env.example : cp .env.example .env.local",
  );
  process.exit(1);
}

const raw = readFileSync(ENV_PATH, "utf8");
const values = new Map();
for (const line of raw.split("\n")) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!match) continue;
  const value = match[2].trim().replace(/^["']|["']$/g, "");
  // Une valeur laissée à « xxx » ou vide compte comme absente.
  values.set(match[1], value && value !== "xxx" && !value.startsWith("sk-xxx") ? value : "");
}

const get = (key) => values.get(key) ?? "";

// ---------------------------------------------------------------------------
// Groupes de variables
// ---------------------------------------------------------------------------
const GROUPS = [
  {
    title: "Supabase (déjà en place)",
    items: [
      { key: "NEXT_PUBLIC_SUPABASE_URL", label: "URL du projet" },
      { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", label: "Clé publique (anon)" },
      { key: "SUPABASE_SERVICE_ROLE_KEY", label: "Clé service_role (serveur uniquement)" },
    ],
  },
  {
    title: "Intelligence artificielle",
    items: [
      { key: "OPENAI_API_KEY", label: "Clé API (tuteur + générateur)", required: false },
      { key: "OPENAI_CHAT_MODEL", label: "Modèle de chat", required: false, fallback: "gpt-4o-mini" },
      {
        key: "OPENAI_EMBEDDING_MODEL",
        label: "Modèle d'embedding",
        required: false,
        fallback: "text-embedding-3-small",
      },
    ],
  },
  {
    title: "Paiement Mobile Money",
    items: [
      { key: "PAYMENT_PROVIDER", label: "Agrégateur retenu", required: false, fallback: "paydunya" },
      { key: "PAYDUNYA_MODE", label: "Mode PayDunya (test/live)", required: false, fallback: "test" },
      { key: "PAYDUNYA_MASTER_KEY", label: "PayDunya — Master Key", required: false },
      { key: "PAYDUNYA_PRIVATE_KEY", label: "PayDunya — Private Key", required: false },
      { key: "PAYDUNYA_TOKEN", label: "PayDunya — Token", required: false },
    ],
  },
];

// ---------------------------------------------------------------------------
// Détection automatique du fournisseur (même logique que le code)
// ---------------------------------------------------------------------------
function detectedVendor() {
  const declared = get("PAYMENT_PROVIDER").toLowerCase();
  if (["paydunya", "cinetpay", "generic"].includes(declared)) return declared;
  if (get("PAYDUNYA_MASTER_KEY") && get("PAYDUNYA_PRIVATE_KEY")) return "paydunya";
  if (get("CINETPAY_API_KEY") && get("CINETPAY_SITE_ID")) return "cinetpay";
  if (get("PAYMENT_API_URL") && get("PAYMENT_API_KEY")) return "generic";
  return "generic";
}

const vendor = detectedVendor();
const aiReady = Boolean(get("OPENAI_API_KEY"));
const paymentReady =
  (vendor === "paydunya" && get("PAYDUNYA_MASTER_KEY") && get("PAYDUNYA_PRIVATE_KEY") && get("PAYDUNYA_TOKEN")) ||
  (vendor === "cinetpay" && get("CINETPAY_API_KEY") && get("CINETPAY_SITE_ID")) ||
  (vendor === "generic" && get("PAYMENT_API_URL") && get("PAYMENT_API_KEY") && get("PAYMENT_WEBHOOK_SECRET"));

const siteUrl = get("NEXT_PUBLIC_SITE_URL") || "http://localhost:3000";

console.log("=== Diagnostic de configuration DIGINIGER ===");
console.log(`Fichier lu : ${ENV_PATH}\n`);

for (const group of GROUPS) {
  console.log(group.title);
  for (const item of group.items) {
    const present = Boolean(get(item.key));
    const display = present
      ? "présent"
      : item.fallback
        ? `absent → valeur par défaut « ${item.fallback} »`
        : "ABSENT";
    console.log(`  ${present ? "✔" : item.fallback ? "•" : "✘"} ${item.label.padEnd(38)} ${display}`);
  }
  console.log("");
}

console.log(`Fournisseur de paiement détecté : ${vendor}`);
console.log(`  → URL de notification à déclarer : ${siteUrl}/api/payments/webhook?provider=mobile_money\n`);

console.log("=== Ce qui est utilisable MAINTENANT ===");
console.log(`  IA (tuteur, générateur)      : ${aiReady ? "✅ activée" : "⛔ non configurée → 503 honnête"}`);
console.log(`  Paiement Mobile Money        : ${paymentReady ? "✅ activé" : "⛔ non configuré → 503 honnête"}`);
console.log("  Tout le reste (cours, examens, certificats, espaces de rôle) : ✅ fonctionnel\n");

if (!aiReady || !paymentReady) {
  console.log("=== Prochaines étapes ===");
  if (!aiReady) {
    console.log(
      "  IA :\n" +
        "    1. Créer une clé sur https://platform.openai.com/api-keys\n" +
        "    2. Ajouter dans .env.local :  OPENAI_API_KEY=sk-...\n" +
        "    3. node scripts/ai-check.mjs      (vérifie que le moteur répond vraiment)\n" +
        "    4. node scripts/index-knowledge.mjs   (indexe les supports pour le RAG)",
    );
  }
  if (!paymentReady) {
    console.log(
      "  Paiement :\n" +
        "    1. Ouvrir un compte marchand sur https://app.paydunya.com → Intégrations > Clés\n" +
        "    2. Ajouter dans .env.local :  PAYDUNYA_MASTER_KEY / PAYDUNYA_PRIVATE_KEY / PAYDUNYA_TOKEN\n" +
        "    3. Déclarer l'URL de notification ci-dessus dans le tableau de bord PayDunya\n" +
        "    4. Redémarrer l'application, puis vérifier /admin/paiements",
    );
  }
  console.log("\n  Sans ces clés, l'application reste utilisable : elle affiche « non configuré » au lieu d'inventer.");
}

if (process.argv.includes("--template")) {
  console.log("\n=== Bloc à compléter dans .env.local ===");
  console.log(`OPENAI_API_KEY=${get("OPENAI_API_KEY") || "sk-xxxxxxxxxxxxxxxx"}
PAYMENT_PROVIDER=paydunya
PAYDUNYA_MODE=test
PAYDUNYA_MASTER_KEY=${get("PAYDUNYA_MASTER_KEY") || "xxxxxxxx"}
PAYDUNYA_PRIVATE_KEY=${get("PAYDUNYA_PRIVATE_KEY") || "xxxxxxxx"}
PAYDUNYA_TOKEN=${get("PAYDUNYA_TOKEN") || "xxxxxxxx"}`);
}

process.exitCode = 0;
