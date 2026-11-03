/**
 * Contrôle « à froid » de la configuration IA.
 * ---------------------------------------------------------------------------
 * Ne se contente pas de vérifier la présence d'une variable : appelle
 * réellement le fournisseur (une complétion courte + un embedding) et vérifie
 * que la dimension des vecteurs correspond à la colonne `vector(1536)`.
 *
 * Codes de sortie :
 *   0 = tout est opérationnel
 *   1 = clé absente ou appel en échec
 *
 * Usage : node scripts/ai-check.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
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

const VECTOR_DIMENSIONS = 1536;
const chatModel = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";
const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
const provider = process.env.AI_PROVIDER === "compatible" ? "compatible" : "openai";
const baseURL = process.env.AI_BASE_URL || undefined;

console.log("=== Configuration IA DIGINIGER ===");
console.log(`Fournisseur      : ${provider}${baseURL ? ` (${baseURL})` : ""}`);
console.log(`Modèle de chat   : ${chatModel}`);
console.log(`Modèle embedding : ${embeddingModel}`);
console.log(`Clé API          : ${process.env.OPENAI_API_KEY ? "présente" : "ABSENTE"}`);

if (!process.env.OPENAI_API_KEY) {
  console.error(
    "\n❌ OPENAI_API_KEY absente.\n" +
      "   Le tuteur et le générateur répondent 503 « non configuré » (aucune réponse inventée).\n" +
      "   Ajoutez la clé dans .env.local puis relancez : node scripts/ai-check.mjs",
  );
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL, timeout: 45_000 });
let failures = 0;

// --- 1. Complétion ----------------------------------------------------------
process.stdout.write("\n1. Complétion de test… ");
try {
  const completion = await openai.chat.completions.create({
    model: chatModel,
    messages: [{ role: "user", content: "Réponds uniquement par le mot : OK" }],
    max_tokens: 8,
    temperature: 0,
  });
  const answer = completion.choices[0]?.message?.content?.trim();
  console.log(answer ? `✅ « ${answer} » (${completion.model})` : "❌ réponse vide");
  if (!answer) failures += 1;
} catch (error) {
  console.log(`❌ ${error.message}`);
  failures += 1;
}

// --- 2. Embedding et dimension ---------------------------------------------
process.stdout.write("2. Embedding de test… ");
let dimensions = 0;
try {
  const embedding = await openai.embeddings.create({
    model: embeddingModel,
    input: "contrôle de la dimension des vecteurs pédagogiques",
    dimensions: VECTOR_DIMENSIONS,
  });
  dimensions = embedding.data[0]?.embedding?.length ?? 0;
  if (dimensions === VECTOR_DIMENSIONS) {
    console.log(`✅ ${dimensions} dimensions`);
  } else {
    console.log(`❌ ${dimensions} dimensions (attendu ${VECTOR_DIMENSIONS})`);
    failures += 1;
  }
} catch (error) {
  console.log(`❌ ${error.message}`);
  failures += 1;
}

// --- 3. Recherche vectorielle réelle dans la base ---------------------------
if (dimensions === VECTOR_DIMENSIONS && process.env.SUPABASE_DB_PASSWORD) {
  process.stdout.write("3. Recherche vectorielle en base… ");
  const db = new pg.Client({
    host: process.env.SUPABASE_DB_HOST ?? "aws-0-eu-west-1.pooler.supabase.com",
    user: process.env.SUPABASE_DB_USER ?? "postgres.dthflsyrhhbpoiecajun",
    password: process.env.SUPABASE_DB_PASSWORD,
    database: process.env.SUPABASE_DB_NAME ?? "postgres",
    ssl: { rejectUnauthorized: false },
  });
  try {
    await db.connect();
    const { rows: counts } = await db.query(
      `select count(distinct d.id)::int as documents, count(c.id)::int as chunks
         from public.course_documents d
         left join public.document_chunks c on c.document_id = d.id
        where d.status = 'indexed'`,
    );
    if (counts[0].chunks === 0) {
      console.log("⚠️  aucun passage indexé (lancer node scripts/index-knowledge.mjs)");
    } else {
      const query = await openai.embeddings.create({
        model: embeddingModel,
        input: "comment fonctionne la comptabilité SYSCOHADA",
        dimensions: VECTOR_DIMENSIONS,
      });
      const { rows } = await db.query(
        `select document_id, left(content, 90) as extrait, 1 - (embedding <=> $1::vector) as similarite
           from public.document_chunks
          order by embedding <=> $1::vector
          limit 3`,
        [JSON.stringify(query.data[0].embedding)],
      );
      console.log(
        `✅ ${counts[0].documents} document(s), ${counts[0].chunks} passage(s) — meilleur score ` +
          `${(Number(rows[0]?.similarite ?? 0) * 100).toFixed(0)} %`,
      );
    }
    await db.end();
  } catch (error) {
    console.log(`❌ ${error.message}`);
    failures += 1;
    await db.end().catch(() => {});
  }
} else {
  console.log("3. Recherche vectorielle en base… ⏭️  ignorée (dimension ou accès base indisponible)");
}

console.log(
  failures === 0
    ? "\n✅ IA opérationnelle : tuteur et générateur utilisables."
    : `\n❌ ${failures} contrôle(s) en échec.`,
);
process.exit(failures === 0 ? 0 : 1);
