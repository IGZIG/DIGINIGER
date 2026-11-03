/**
 * Bac à sable de paiement — preuve de bout en bout SANS compte marchand.
 * ---------------------------------------------------------------------------
 * Ce script démarre un faux agrégateur qui reproduit les contrats réels de
 * PayDunya et CinetPay (création de facture, IPN, API de confirmation), puis
 * exécute les scénarios suivants contre l'application réelle :
 *
 *   1. notification valide + confirmation « completed »  → accès ouvert ;
 *   2. rejeu de la même notification                     → idempotent, pas de doublon ;
 *   3. notification forgée (hash PayDunya correct mais montant mensonger)
 *      → la confirmation serveur-à-serveur rétablit le vrai montant et REFUSE ;
 *   4. montant confirmé ≠ montant en base                 → 409, aucun accès ;
 *   5. signature invalide                                 → 401 ;
 *   6. fournisseur injoignable pendant la confirmation     → 502 (rejeu attendu).
 *
 * Le script vérifie ensuite en base l'état réel (transactions, inscriptions).
 *
 * Usage :
 *   node scripts/payment-sandbox.mjs
 *
 * Prérequis : l'application tourne sur http://127.0.0.1:3000.
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
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

const APP_PORT = Number(process.env.SANDBOX_APP_PORT ?? 3100);
const APP = process.env.SANDBOX_APP_URL ?? `http://127.0.0.1:${APP_PORT}`;
const PORT = Number(process.env.SANDBOX_PORT ?? 4545);
const HOST = `http://127.0.0.1:${PORT}`;
const MASTER_KEY = "sandbox-master-key-DIGINIGER";

// La signature de l'application est calculée avec PAYMENT_WEBHOOK_SECRET :
// on la réutilise pour forger des notifications « valides ».
const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET ?? "sandbox-webhook-secret";
process.env.PAYMENT_WEBHOOK_SECRET = WEBHOOK_SECRET;

let passed = 0;
const failures = [];
function check(label, ok, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  ✔ ${label}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ✘ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// ---------------------------------------------------------------------------
// Faux agrégateur (contrats PayDunya + CinetPay)
// ---------------------------------------------------------------------------
/** Factures simulées : token → { reference, amount, status, confirmed } */
const invoices = new Map();
let confirmationMode = "ok"; // ok | down | mismatch-amount

const server = createServer((request, response) => {
  const url = new URL(request.url, HOST);
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    const json = (status, payload) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(payload));
    };

    // --- Création de facture PayDunya
    if (request.method === "POST" && url.pathname === "/paydunya/checkout-invoice/create") {
      const payload = JSON.parse(body || "{}");
      const token = `tok_${crypto.randomUUID().slice(0, 10)}`;
      invoices.set(token, {
        reference: payload.custom_data?.reference ?? "",
        amount: Number(payload.invoice?.total_amount ?? 0),
        status: "pending",
      });
      return json(200, { response_code: "00", response_text: "Facture créée", token });
    }

    // --- Confirmation PayDunya
    if (request.method === "GET" && url.pathname.startsWith("/paydunya/checkout-invoice/confirm/")) {
      if (confirmationMode === "down") {
        // Panne simulée : 503 → l'application doit répondre 502 et ne rien créditer.
        return json(503, { response_code: "500", response_text: "Panne simulateur" });
      }
      const token = decodeURIComponent(url.pathname.split("/").pop());
      const invoice = invoices.get(token);
      if (!invoice) return json(200, { response_code: "100", response_text: "Facture inconnue" });

      const amount =
        confirmationMode === "mismatch-amount" ? invoice.amount + 5000 : invoice.amount;

      return json(200, {
        response_code: "00",
        status: invoice.status,
        invoice: { token, total_amount: amount },
        custom_data: { reference: invoice.reference },
      });
    }

    // --- Création de paiement CinetPay
    if (request.method === "POST" && url.pathname === "/cinetpay/v2/payment") {
      const payload = JSON.parse(body || "{}");
      const token = `cin_${crypto.randomUUID().slice(0, 10)}`;
      invoices.set(token, {
        reference: payload.metadata ?? "",
        amount: Number(payload.amount ?? 0),
        status: "accepted",
        cinetpay: true,
      });
      return json(201, {
        code: "201",
        message: "Paiement initié",
        data: { payment_url: `${HOST}/pay/${token}`, payment_token: token },
      });
    }

    // --- Vérification CinetPay
    if (request.method === "POST" && url.pathname === "/cinetpay/v2/payment/check") {
      const payload = JSON.parse(body || "{}");
      const invoice = invoices.get(payload.transaction_id);
      if (!invoice) return json(200, { code: "100", message: "Transaction inconnue" });
      return json(200, {
        code: "00",
        data: {
          cpm_result: "00",
          cpm_amount: invoice.amount,
          cpm_trans_id: payload.transaction_id,
          cpm_custom: invoice.reference,
          cpm_trans_status: "ACCEPTED",
        },
      });
    }

    return json(404, { error: "NOT_FOUND", path: url.pathname });
  });
});

await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));
console.log(`Faux agrégateur à l'écoute sur ${HOST}`);

// ---------------------------------------------------------------------------
// Instances applicatives dédiées, configurées pour pointer vers le simulateur.
// Aucune clé réelle n'est utilisée : c'est précisément l'intérêt du bac à sable.
// ---------------------------------------------------------------------------
const appProcesses = [];

async function startApp(port, extraEnv) {
  const child = spawn("node", ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PAYDUNYA_MODE: "test",
      PAYDUNYA_MASTER_KEY: MASTER_KEY,
      PAYDUNYA_PRIVATE_KEY: "sandbox-private-key",
      PAYDUNYA_TOKEN: "sandbox-token",
      PAYDUNYA_API_URL: `${HOST}/paydunya`,
      PAYDUNYA_CHECKOUT_URL: `${HOST}/pay`,
      CINETPAY_API_KEY: "sandbox-cinetpay-key",
      CINETPAY_SITE_ID: "sandbox-site",
      CINETPAY_API_URL: `${HOST}/cinetpay`,
      PAYMENT_WEBHOOK_SECRET: WEBHOOK_SECRET,
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", () => {});
  child.stderr.on("data", (chunk) => {
    const text = String(chunk);
    if (!text.includes("ExperimentalWarning")) process.stderr.write(`[app:${port}] ${text}`);
  });
  appProcesses.push(child);

  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await sleep(500);
    try {
      const response = await fetch(`${base}/api/payments/webhook`, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return base;
    } catch {
      // pas encore prêt
    }
  }
  throw new Error(`L'application n'a pas démarré sur ${base} (npm run build d'abord ?)`);
}

let APP_PAYDUNYA;
let APP_CINETPAY;
try {
  APP_PAYDUNYA = await startApp(APP_PORT, { PAYMENT_PROVIDER: "paydunya" });
  console.log(`Instance PayDunya sur ${APP_PAYDUNYA}`);
  APP_CINETPAY = await startApp(APP_PORT + 1, { PAYMENT_PROVIDER: "cinetpay" });
  console.log(`Instance CinetPay sur ${APP_CINETPAY}`);
} catch (error) {
  console.error(error.message);
  for (const child of appProcesses) child.kill("SIGKILL");
  server.close();
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Base de données pour préparer et relire l'état réel
// ---------------------------------------------------------------------------
const db = new pg.Client({
  host: process.env.SUPABASE_DB_HOST ?? "aws-0-eu-west-1.pooler.supabase.com",
  user: process.env.SUPABASE_DB_USER ?? "postgres.dthflsyrhhbpoiecajun",
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME ?? "postgres",
  ssl: { rejectUnauthorized: false },
});
await db.connect();

function sign(body) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const v1 = crypto.createHmac("sha256", WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

async function postWebhook(query, body, headers = {}, app = APP_PAYDUNYA) {
  const response = await fetch(`${app}/api/payments/webhook?${query}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
    signal: AbortSignal.timeout(30_000),
  });
  return { status: response.status, json: await response.json().catch(() => null) };
}

/** Crée une transaction réelle en base, comme le ferait /api/payments/checkout. */
async function createTransaction({ amount = 5000, withEnrollment = true } = {}) {
  const reference = `SBX-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
  const { rows: users } = await db.query(
    "select id from profiles where email = 'etudiant2.demo@diginiger.test'",
  );
  const { rows: courses } = await db.query(
    "select id from courses where is_free = false and status = 'published' order by created_at limit 1",
  );
  const courseId = withEnrollment ? courses[0]?.id : null;

  await db.query(
    `insert into transactions (reference, user_id, course_id, amount_xof, total_xof, provider, status, metadata)
     values ($1, $2, $3, $4, $4, 'mobile_money', 'pending', '{"description":"Bac à sable"}'::jsonb)`,
    [reference, users[0].id, courseId ?? null, amount],
  );

  return { reference, courseId: courseId ?? null, userId: users[0].id };
}

async function enrollmentCount(userId, courseId) {
  if (!courseId) return 0;
  const { rows } = await db.query(
    "select count(*)::int c from enrollments where user_id = $1 and course_id = $2",
    [userId, courseId],
  );
  return rows[0].c;
}

async function stateOf(reference) {
  const { rows } = await db.query(
    "select t.status, t.paid_at, t.provider_ref, t.course_id, t.user_id from transactions t where t.reference = $1",
    [reference],
  );
  const transaction = rows[0];
  let enrolled = false;
  if (transaction?.course_id) {
    const { rows: enrollment } = await db.query(
      "select 1 from enrollments where user_id = $1 and course_id = $2",
      [transaction.user_id, transaction.course_id],
    );
    enrolled = enrollment.length > 0;
  }
  return { ...transaction, enrolled };
}

// ---------------------------------------------------------------------------
// Scénarios
// ---------------------------------------------------------------------------
console.log("\n=== 1. Notification valide + confirmation « completed » → accès ouvert");
const tx1 = await createTransaction({ amount: 5000 });
const token1 = `tok_ok_${crypto.randomUUID().slice(0, 8)}`;
invoices.set(token1, { reference: tx1.reference, amount: 5000, status: "completed" });

const ipn1 = JSON.stringify({
  data: {
    hash: crypto.createHash("sha512").update(MASTER_KEY).digest("hex"),
    status: "completed",
    invoice: { token: token1, total_amount: 5000 },
    custom_data: { reference: tx1.reference },
  },
});
const r1 = await postWebhook("provider=mobile_money", ipn1, { "x-signature": sign(ipn1) });
const s1 = await stateOf(tx1.reference);
check("webhook accepté (200)", r1.status === 200, `HTTP ${r1.status}`);
check("transaction passée à « paid »", s1.status === "paid", s1.status);
check("inscription créée automatiquement", s1.enrolled === true);
check("provider_ref enregistré", Boolean(s1.provider_ref));

console.log("\n=== 2. Rejeu de la même notification → idempotent");
const r2 = await postWebhook("provider=mobile_money", ipn1, { "x-signature": sign(ipn1) });
check("détectée comme doublon", r2.json?.duplicate === true || r2.json?.alreadyPaid === true, JSON.stringify(r2.json));
const { rows: events } = await db.query(
  "select count(*)::int c from payment_events where event_id = $1",
  [`paydunya:${token1}:completed`],
);
check("un seul événement enregistré", events[0].c === 1, `${events[0].c} événement(s)`);

console.log("\n=== 3. Notification forgée (montant mensonger) → confirmation serveur refuse");
const tx3 = await createTransaction({ amount: 15000 });
const enrolledBefore3 = await enrollmentCount(tx3.userId, tx3.courseId);
const token3 = `tok_forge_${crypto.randomUUID().slice(0, 8)}`;
// Le vrai montant côté fournisseur est 500, la notification prétend 15000.
invoices.set(token3, { reference: tx3.reference, amount: 500, status: "completed" });
const ipn3 = JSON.stringify({
  data: {
    hash: crypto.createHash("sha512").update(MASTER_KEY).digest("hex"),
    status: "completed",
    invoice: { token: token3, total_amount: 15000 },
    custom_data: { reference: tx3.reference },
  },
});
const r3 = await postWebhook("provider=mobile_money", ipn3, { "x-signature": sign(ipn3) });
const s3 = await stateOf(tx3.reference);
check("rejetée (409 AMOUNT_MISMATCH)", r3.status === 409, `HTTP ${r3.status} ${JSON.stringify(r3.json)}`);
check(
  "aucune inscription créée",
  (await enrollmentCount(tx3.userId, tx3.courseId)) === enrolledBefore3,
  `avant ${enrolledBefore3}, après ${await enrollmentCount(tx3.userId, tx3.courseId)}`,
);

console.log("\n=== 4. Montant confirmé ≠ montant attendu (source : API du fournisseur)");
const tx4 = await createTransaction({ amount: 3000 });
const token4 = `tok_mismatch_${crypto.randomUUID().slice(0, 8)}`;
invoices.set(token4, { reference: tx4.reference, amount: 3000, status: "completed" });
confirmationMode = "mismatch-amount";
const ipn4 = JSON.stringify({
  data: {
    hash: crypto.createHash("sha512").update(MASTER_KEY).digest("hex"),
    status: "completed",
    invoice: { token: token4, total_amount: 3000 },
    custom_data: { reference: tx4.reference },
  },
});
const r4 = await postWebhook("provider=mobile_money", ipn4, { "x-signature": sign(ipn4) });
confirmationMode = "ok";
const s4 = await stateOf(tx4.reference);
check("rejetée sur le montant confirmé", r4.status === 409, `HTTP ${r4.status}`);
check("aucun accès ouvert", s4.status !== "paid");

console.log("\n=== 5. Authenticité de la notification (hash PayDunya)");
// PayDunya n'envoie pas de signature HMAC : l'authentification repose sur
// data.hash = SHA-512(master key). Un hash erroné doit être rejeté d'emblée.
const ipnBadHash = JSON.stringify({
  data: {
    hash: "0".repeat(128),
    status: "completed",
    invoice: { token: "tok_inconnu", total_amount: 5000 },
    custom_data: { reference: tx1.reference },
  },
});
const r5 = await postWebhook("provider=mobile_money", ipnBadHash);
check("hash invalide → 401", r5.status === 401, `HTTP ${r5.status}`);

// Une notification « authentique » mais visant une transaction inconnue ne
// doit rien ouvrir non plus.
const ipnUnknownRef = JSON.stringify({
  data: {
    hash: crypto.createHash("sha512").update(MASTER_KEY).digest("hex"),
    status: "completed",
    invoice: { token: "tok_inconnu", total_amount: 5000 },
    custom_data: { reference: "DIG-INEXISTANT" },
  },
});
const r5b = await postWebhook("provider=mobile_money", ipnUnknownRef);
check("transaction inconnue ignorée (200 matched:false)", r5b.status === 200 && r5b.json?.matched === false, JSON.stringify(r5b.json));

console.log("\n=== 6. Fournisseur injoignable pendant la confirmation → 502");
const tx6 = await createTransaction({ amount: 2000 });
const token6 = `tok_down_${crypto.randomUUID().slice(0, 8)}`;
invoices.set(token6, { reference: tx6.reference, amount: 2000, status: "completed" });
confirmationMode = "down";
const ipn6 = JSON.stringify({
  data: {
    hash: crypto.createHash("sha512").update(MASTER_KEY).digest("hex"),
    status: "completed",
    invoice: { token: token6, total_amount: 2000 },
    custom_data: { reference: tx6.reference },
  },
});
const r6 = await postWebhook("provider=mobile_money", ipn6, { "x-signature": sign(ipn6) });
confirmationMode = "ok";
const s6 = await stateOf(tx6.reference);
check("réponse 502 (rejeu attendu)", r6.status === 502, `HTTP ${r6.status}`);
check("aucun accès ouvert sans confirmation", s6.status !== "paid", s6.status);

console.log("\n=== 7. Second agrégateur : CinetPay (même application, autre instance)");
const tx7 = await createTransaction({ amount: 7500 });
const cinToken = `cin_ok_${crypto.randomUUID().slice(0, 8)}`;
invoices.set(cinToken, { reference: tx7.reference, amount: 7500, status: "accepted", cinetpay: true });

const cinBody = JSON.stringify({
  cpm_data: {
    cpm_result: "00",
    cpm_amount: 7500,
    cpm_trans_id: cinToken,
    cpm_custom: tx7.reference,
    cpm_trans_status: "ACCEPTED",
  },
});
const cinTimestamp = String(Math.floor(Date.now() / 1000));
const cinToken_header = `t=${cinTimestamp},v1=${crypto
  .createHmac("sha256", WEBHOOK_SECRET)
  .update(`${cinTimestamp}.${cinBody}`)
  .digest("hex")}`;

const r7bad = await postWebhook("provider=mobile_money", cinBody, { "x-token": "invalide" }, APP_CINETPAY);
check("x-token invalide → 401", r7bad.status === 401, `HTTP ${r7bad.status}`);

const r7 = await postWebhook("provider=mobile_money", cinBody, { "x-token": cinToken_header }, APP_CINETPAY);
const s7 = await stateOf(tx7.reference);
check("notification CinetPay acceptée", r7.status === 200, `HTTP ${r7.status} ${JSON.stringify(r7.json)}`);
check("transaction confirmée payée", s7.status === "paid", s7.status);
// L'utilisateur de démonstration peut déjà être inscrit au même cours par un
// scénario précédent : on vérifie l'existence de l'inscription, pas un delta.
check("inscription ouverte après confirmation", (await stateOf(tx7.reference)).enrolled === true);

// ---------------------------------------------------------------------------
// Nettoyage : on retire uniquement les données créées par ce script.
// ---------------------------------------------------------------------------
const createdRefs = [tx1, tx3, tx4, tx6, tx7].map((tx) => tx.reference);
await db.query(
  "delete from enrollments where course_id = any($1::uuid[]) and user_id = any($2::uuid[])",
  [createdRefs.map(() => tx1.courseId), createdRefs.map(() => tx1.userId)],
);
await db.query("delete from payment_events where event_id like 'paydunya:%' or event_id like 'cinetpay:%'");
await db.query("delete from transactions where reference like 'SBX-%'");

await db.end();
server.close();
for (const child of appProcesses) child.kill("SIGTERM");

console.log(`\n=== Résultat : ${passed} réussie(s), ${failures.length} échec(s)`);
if (failures.length) {
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
