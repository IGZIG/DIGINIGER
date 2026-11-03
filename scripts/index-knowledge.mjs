import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import pg from "pg";

/**
 * Indexation réelle des documents pédagogiques pour le tuteur IA (RAG).
 * ---------------------------------------------------------------------------
 * - Idempotent : les chunks d'un document sont supprimés puis recréés.
 * - Contrôle la dimension des vecteurs AVANT insertion (la colonne est
 *   vector(1536) ; un modèle 3072 ferait échouer l'insertion).
 * - Sans OPENAI_API_KEY : s'arrête avec un code de sortie 1 et un message
 *   explicite ; ne crée aucun contenu factice.
 *
 * Usage :
 *   node scripts/index-knowledge.mjs            # tous les documents en attente
 *   node scripts/index-knowledge.mjs --all      # réindexe tout
 *   node scripts/index-knowledge.mjs --no-lessons   # ignore le contenu des leçons
 */

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

const args = process.argv.slice(2);
const REINDEX_ALL = args.includes("--all");
// Par défaut, la source est le contenu des leçons rédigées par les formateurs
// (contenu réellement validé). `--no-lessons` force l'ancien comportement.
const INCLUDE_LESSONS = !args.includes("--no-lessons");

if (!process.env.OPENAI_API_KEY) {
  console.error(
    "OPENAI_API_KEY absente : impossible de calculer les embeddings.\n" +
      "Renseignez la clé dans .env.local, puis relancez cette commande.\n" +
      "Aucun contenu factice n'est généré.",
  );
  process.exit(1);
}

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
const VECTOR_DIMENSIONS = 1536;
const MAX_CHARS = 1200;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_BASE_URL || undefined,
  timeout: 60_000,
  maxRetries: 2,
});

const db = new pg.Client({
  host: process.env.SUPABASE_DB_HOST ?? "aws-0-eu-west-1.pooler.supabase.com",
  port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
  user: process.env.SUPABASE_DB_USER ?? "postgres.dthflsyrhhbpoiecajun",
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME ?? "postgres",
  ssl: { rejectUnauthorized: false },
  statement_timeout: 180_000,
});
await db.connect();

function chunkText(text) {
  const cleaned = text.replace(/\r/g, "").trim();
  const paragraphs = cleaned.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  const chunks = [];
  let buffer = "";
  for (const paragraph of paragraphs) {
    if ((buffer + paragraph).length > MAX_CHARS && buffer) {
      chunks.push(buffer.trim());
      buffer = "";
    }
    buffer += `${paragraph}\n\n`;
  }
  if (buffer.trim()) chunks.push(buffer.trim());
  return chunks;
}

const { rows: documents } = await db.query(
  `select d.id, d.title, d.course_id, d.status, c.title_fr as course_title, c.status as course_status
     from public.course_documents d
     join public.courses c on c.id = d.course_id
    ${REINDEX_ALL ? "" : "where d.status <> 'indexed'"}
    order by d.created_at`,
);

if (documents.length === 0) {
  console.log("Aucun document à indexer (tous sont déjà indexés). Utilisez --all pour réindexer.");
  await db.end();
  process.exit(0);
}

console.log(`→ ${documents.length} document(s) à indexer, modèle ${EMBEDDING_MODEL}`);

let totalChunks = 0;

for (const document of documents) {
  // Le texte source est reconstitué depuis les leçons du cours : c'est le
  // contenu réellement validé par le formateur, pas un texte inventé.
  const { rows: lessons } = INCLUDE_LESSONS
    ? await db.query(
        `select l.title_fr, l.content_md, m.title_fr as module_title, m.position as module_position
           from public.lessons l
           join public.modules m on m.id = l.module_id
          where m.course_id = $1 and l.content_md is not null
          order by m.position, l.position`,
        [document.course_id],
      )
    : { rows: [] };

  const text = lessons.length
    ? lessons
        .map(
          (lesson) =>
            `Module : ${lesson.module_title}\nLeçon : ${lesson.title_fr}\n\n${lesson.content_md}`,
        )
        .join("\n\n")
    : null;

  if (!text || text.trim().length < 40) {
    console.log(`  ⚠ ${document.title} — aucune leçon rédigée, indexation ignorée`);
    await db.query(
      `update public.course_documents set status='pending', chunk_count=0, error=$2, updated_at=now() where id=$1`,
      [document.id, "Aucun contenu de leçon à indexer"],
    );
    continue;
  }

  const chunks = chunkText(text).slice(0, 200);
  const embedding = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: chunks.map((chunk) => chunk.slice(0, 8000)),
    dimensions: VECTOR_DIMENSIONS,
  });

  const first = embedding.data[0]?.embedding ?? [];
  if (first.length !== VECTOR_DIMENSIONS) {
    console.error(
      `  ✘ ${document.title} — dimension ${first.length} ≠ ${VECTOR_DIMENSIONS}. ` +
        "Aucune donnée insérée. Utilisez OPENAI_EMBEDDING_MODEL=text-embedding-3-small.",
    );
    process.exitCode = 1;
    continue;
  }

  await db.query("begin");
  try {
    await db.query("delete from public.document_chunks where document_id = $1", [document.id]);

    for (let index = 0; index < chunks.length; index += 1) {
      await db.query(
        `insert into public.document_chunks (document_id, course_id, position, content, token_count, embedding)
         values ($1, $2, $3, $4, $5, $6::vector)`,
        [
          document.id,
          document.course_id,
          index,
          `${document.title} — partie ${index + 1}\n${chunks[index]}`,
          Math.ceil(chunks[index].length / 4),
          JSON.stringify(embedding.data[index].embedding),
        ],
      );
    }

    await db.query(
      `update public.course_documents
          set status='indexed', chunk_count=$2, error=null, updated_at=now()
        where id=$1`,
      [document.id, chunks.length],
    );
    await db.query("commit");
    totalChunks += chunks.length;
    console.log(`  ✔ ${document.title} — ${chunks.length} passages indexés`);
  } catch (error) {
    await db.query("rollback");
    await db.query(
      `update public.course_documents set status='failed', error=$2, updated_at=now() where id=$1`,
      [document.id, String(error.message).slice(0, 300)],
    );
    console.error(`  ✘ ${document.title} — ${error.message}`);
    process.exitCode = 1;
  }
}

const { rows: summary } = await db.query(
  `select count(distinct d.id)::int as documents, count(c.id)::int as chunks
     from public.course_documents d
     left join public.document_chunks c on c.document_id = d.id
    where d.status = 'indexed'`,
);

console.log(
  `\nBase RAG : ${summary[0].documents} document(s) indexé(s), ${summary[0].chunks} passage(s) ` +
    `(ce lot : +${totalChunks}).`,
);
await db.end();
