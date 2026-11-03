/**
 * Génère un en-tête `Cookie` valide pour une session Supabase, afin de pouvoir
 * tester les pages protégées en curl (vérification du rendu réel, pas seulement
 * de la redirection). Reproduit exactement le format utilisé par @supabase/ssr :
 * cookie `sb-<ref>-auth-token` (découpé tous les 3180 caractères) + `base64-`.
 *
 * Usage :
 *   node scripts/session-cookie.mjs etudiant.demo@diginiger.test
 *   node scripts/session-cookie.mjs admin.demo@diginiger.test --password '...'
 *
 * La sortie est la valeur à passer à `curl -H "Cookie: ..."`. Aucun secret
 * n'est écrit sur disque.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

// Node 20 n'a pas de WebSocket natif : `ws` sert uniquement de transport Realtime.
const { default: ws } = await import("ws").catch(() => ({ default: undefined }));

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

const email = process.argv[2];
const flagIndex = process.argv.indexOf("--password");
const password =
  flagIndex > -1 ? process.argv[flagIndex + 1] : process.env.DEMO_PASSWORD || "Diginiger2026!";

if (!email) {
  console.error("Usage : node scripts/session-cookie.mjs <email> [--password <mdp>]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / ANON_KEY manquants dans .env.local");
  process.exit(1);
}

// Node 20 n'a pas de WebSocket natif : on désactive Realtime au lieu d'exiger `ws`.
const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  ...(ws ? { realtime: { transport: ws } } : {}),
});

const { data, error } = await supabase.auth.signInWithPassword({ email, password });
if (error || !data.session) {
  console.error("Connexion impossible :", error?.message ?? "session absente");
  process.exit(1);
}

const ref = new URL(url).hostname.split(".")[0];
const key = `sb-${ref}-auth-token`;
const encoded = "base64-" + Buffer.from(JSON.stringify(data.session), "utf8").toString("base64url");
const CHUNK = 3180;

const parts = [];
if (encodeURIComponent(encoded).length <= CHUNK) {
  parts.push(`${key}=${encoded}`);
} else {
  let rest = encoded;
  let index = 0;
  while (rest.length > 0) {
    // Découpage sur des frontières sûres : base64url ne contient aucun %.
    const head = rest.slice(0, CHUNK);
    rest = rest.slice(CHUNK);
    parts.push(`${key}.${index}=${head}`);
    index += 1;
  }
}

console.log(parts.join("; "));
