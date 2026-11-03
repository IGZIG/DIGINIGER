import "server-only";
import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * DIGINIGER AI — cœur serveur (multi-fournisseurs).
 * ---------------------------------------------------------------------------
 * Principes :
 *  1. Le modèle ne répond JAMAIS sans contexte validé quand un cours est fourni
 *     (recherche vectorielle sur document_chunks, poussée en RAG).
 *  2. Aucune clé API côté client : cet import n'est possible qu'en server-only.
 *  3. Fournisseur interchangeable par configuration :
 *       - `openai`     : API OpenAI (https://api.openai.com/v1)
 *       - `compatible` : tout endpoint compatible OpenAI (Azure OpenAI, Groq,
 *                        Mistral, OpenRouter, vLLM, Ollama en mode OpenAI…)
 *  4. Famille d'embeddings configurable (`OPENAI_EMBEDDING_DIMENSIONS`) :
 *     la colonne `vector(1536)` de PostgreSQL est figée, donc la dimension
 *     réelle du modèle est vérifiée au démarrage plutôt que découverte à
 *     l'exécution (une dimension différente corromprait la recherche).
 *  5. Si la clé est absente, on lève AI_NOT_CONFIGURED : l'UI affiche un
 *     message honnête au lieu d'une réponse simulée.
 */

export type AiProvider = "openai" | "compatible";
export type EmbeddingFamily = "text-embedding-3-small" | "text-embedding-3-large";

/** Dimension de la colonne `document_chunks.embedding` (migration 0003). */
export const VECTOR_DIMENSIONS = 1536;

const FAMILY_DIMENSIONS: Record<EmbeddingFamily, number> = {
  "text-embedding-3-small": 1536,
  "text-embedding-3-large": 3072,
};

export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function provider(): AiProvider {
  return process.env.AI_PROVIDER === "compatible" ? "compatible" : "openai";
}

function baseURL(): string | undefined {
  if (provider() === "compatible") {
    return process.env.AI_BASE_URL || undefined;
  }
  return process.env.AI_BASE_URL || undefined; // permet aussi un proxy OpenAI
}

function client() {
  if (!isAiConfigured()) throw new Error("AI_NOT_CONFIGURED");
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: baseURL(),
    timeout: 45_000,
    maxRetries: 1,
  });
}

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";
const EMBEDDING_MODEL = (process.env.OPENAI_EMBEDDING_MODEL ??
  "text-embedding-3-small") as EmbeddingFamily;

function embeddingDimensions(): number {
  const declared = Number(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? VECTOR_DIMENSIONS);
  return Number.isFinite(declared) && declared > 0 ? declared : VECTOR_DIMENSIONS;
}

/**
 * Diagnostic de configuration, affiché dans /admin/parametres et renvoyé par
 * /api/ai/status. Ne divulgue jamais la clé : seulement sa présence.
 */
export interface AiConfigReport {
  configured: boolean;
  provider: AiProvider;
  baseURLHost: string | null;
  chatModel: string;
  embeddingModel: string;
  embeddingDimensions: number;
  /** true si la dimension demandée correspond à la colonne vectorielle. */
  dimensionsCompatible: boolean;
  warnings: string[];
}

export function aiConfigReport(): AiConfigReport {
  const warnings: string[] = [];
  const dimensions = embeddingDimensions();
  const modelDimensions = FAMILY_DIMENSIONS[EMBEDDING_MODEL];

  if (!isAiConfigured()) {
    warnings.push("OPENAI_API_KEY absente : tuteur et générateur répondent « non configuré » (503).");
  }
  if (provider() === "compatible" && !process.env.AI_BASE_URL) {
    warnings.push("AI_PROVIDER=compatible sans AI_BASE_URL : aucun endpoint à contacter.");
  }
  if (modelDimensions && dimensions !== VECTOR_DIMENSIONS) {
    warnings.push(
      `${EMBEDDING_MODEL} produit ${modelDimensions} dimensions mais la colonne vector(1536) en attend 1536 : ` +
        "il faut une migration avant indexation (ou OPENAI_EMBEDDING_MODEL=text-embedding-3-small).",
    );
  }
  if (!modelDimensions) {
    warnings.push(
      `Modèle d'embedding « ${EMBEDDING_MODEL} » hors familles connues : dimension non vérifiable, ` +
        `OPENAI_EMBEDDING_DIMENSIONS=${dimensions} sera utilisé et contrôlé au premier appel.`,
    );
  }

  let host: string | null = null;
  if (baseURL()) {
    try {
      host = new URL(baseURL()!).host;
    } catch {
      warnings.push("AI_BASE_URL n'est pas une URL valide.");
    }
  }

  return {
    configured: isAiConfigured(),
    provider: provider(),
    baseURLHost: host,
    chatModel: CHAT_MODEL,
    embeddingModel: EMBEDDING_MODEL,
    embeddingDimensions: dimensions,
    dimensionsCompatible: dimensions === VECTOR_DIMENSIONS,
    warnings,
  };
}

/**
 * Vérification « à froid » : appelle réellement le fournisseur et contrôle la
 * dimension renvoyée. Sert au script `npm run ai:check` et au bouton de test
 * de l'administration — on ne se contente pas de la présence d'une variable.
 */
export async function probeAi(): Promise<{
  chat: { ok: boolean; model?: string; error?: string };
  embeddings: { ok: boolean; model?: string; dimensions?: number; error?: string };
}> {
  if (!isAiConfigured()) {
    return {
      chat: { ok: false, error: "AI_NOT_CONFIGURED" },
      embeddings: { ok: false, error: "AI_NOT_CONFIGURED" },
    };
  }

  const openai = client();
  const result: Awaited<ReturnType<typeof probeAi>> = {
    chat: { ok: false },
    embeddings: { ok: false },
  };

  try {
    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [{ role: "user", content: "Réponds uniquement par le mot : OK" }],
      max_tokens: 8,
      temperature: 0,
    });
    result.chat = { ok: Boolean(completion.choices[0]?.message?.content), model: completion.model };
  } catch (error) {
    result.chat = { ok: false, error: error instanceof Error ? error.message : "UNKNOWN" };
  }

  try {
    const embedding = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: "vérification de la dimension des embeddings",
    });
    const dimensions = embedding.data[0]?.embedding?.length ?? 0;
    result.embeddings = {
      ok: dimensions === VECTOR_DIMENSIONS,
      model: embedding.model,
      dimensions,
      error:
        dimensions === VECTOR_DIMENSIONS
          ? undefined
          : `dimension ${dimensions} ≠ ${VECTOR_DIMENSIONS} attendue par la colonne vector`,
    };
  } catch (error) {
    result.embeddings = { ok: false, error: error instanceof Error ? error.message : "UNKNOWN" };
  }

  return result;
}

export interface RetrievedChunk {
  chunk_id: string;
  document_id: string;
  content: string;
  similarity: number;
}

/** Embeddings d'une requête utilisateur. */
export async function embedQuery(text: string): Promise<number[]> {
  const openai = client();
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000),
  });
  const vector = response.data[0].embedding;
  if (vector.length !== VECTOR_DIMENSIONS) {
    throw new Error(`EMBEDDING_DIMENSION_MISMATCH:${vector.length}`);
  }
  return vector;
}

/** Recherche des passages pertinents du cours (respecte can_access_course). */
export async function retrieveContext(
  admin: SupabaseClient,
  courseId: string,
  query: string,
): Promise<RetrievedChunk[]> {
  const embedding = await embedQuery(query);
  const { data, error } = await admin.rpc("match_course_chunks", {
    p_course_id: courseId,
    p_embedding: embedding,
    p_match_count: 6,
    p_min_similarity: 0.72,
  });

  if (error || !data) return [];
  return data as RetrievedChunk[];
}

export interface TutorContext {
  studentName: string;
  level: "debutant" | "intermediaire" | "avance" | null;
  courseTitle: string | null;
  lessonTitle: string | null;
  recentScores: number[];
  chunks: RetrievedChunk[];
}

const SYSTEM_PROMPT = `Tu es le tuteur pédagogique de DIGINIGER, académie numérique du Niger et d'Afrique de l'Ouest.

RÈGLES ABSOLUES :
1. Réponds en français clair, simple et structuré. Si l'apprenant écrit en anglais, réponds en anglais.
2. Appuie-toi EN PRIORITÉ sur les extraits de cours fournis dans le bloc CONTEXTE. Si le contexte ne couvre pas la question, dis-le explicitement et propose une réponse générale en le signalant.
3. N'invente jamais une règle, un chiffre, une procédure fiscale ou juridique précise. En cas de doute : « Vérifiez auprès de votre formateur ».
4. Adapte la longueur et le vocabulaire au niveau déclaré de l'apprenant.
5. Utilise des exemples concrets et locaux (Niger, Afrique de l'Ouest, FCFA) quand c'est pertinent.
6. Termine, si utile, par une question courte qui vérifie la compréhension.
7. Ne promets jamais une note, un certificat ou une validation : seules les évaluations de la plateforme le font.
8. Refuse poliment toute demande hors sujet (contenu illégal, conseil médical, etc.).

FORMAT : paragraphes courts, listes à puces quand c'est utile, pas de titres markdown superflus.`;

export function buildMessages(
  context: TutorContext,
  history: { role: "user" | "assistant"; content: string }[],
  question: string,
) {
  const contextBlock = context.chunks.length
    ? context.chunks
        .map((chunk, index) => `[Extrait ${index + 1} — pertinence ${(chunk.similarity * 100).toFixed(0)} %]\n${chunk.content}`)
        .join("\n\n")
    : "Aucun extrait de cours n'a été trouvé pour cette question.";

  const systemMeta = [
    `Apprenant : ${context.studentName || "apprenant"}`,
    context.level ? `Niveau déclaré : ${context.level}` : null,
    context.courseTitle ? `Formation en cours : ${context.courseTitle}` : null,
    context.lessonTitle ? `Leçon consultée : ${context.lessonTitle}` : null,
    context.recentScores.length
      ? `Scores récents : ${context.recentScores.join(", ")} / 100`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "system" as const, content: `CONTEXTE DU COURS :\n${contextBlock}` },
    { role: "system" as const, content: `PROFIL :\n${systemMeta}` },
    ...history.slice(-8),
    { role: "user" as const, content: question },
  ];
}

export interface TutorAnswer {
  content: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  citations: { title: string; chunk_id: string; similarity: number }[];
}

export async function askTutor(
  context: TutorContext,
  history: { role: "user" | "assistant"; content: string }[],
  question: string,
): Promise<TutorAnswer> {
  const openai = client();

  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: buildMessages(context, history, question),
    temperature: 0.4,
    max_tokens: 900,
  });

  const content = completion.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("AI_EMPTY_RESPONSE");

  return {
    content,
    model: completion.model,
    tokensIn: completion.usage?.prompt_tokens ?? 0,
    tokensOut: completion.usage?.completion_tokens ?? 0,
    citations: context.chunks.map((chunk, index) => ({
      title: `Extrait ${index + 1}`,
      chunk_id: chunk.chunk_id,
      similarity: chunk.similarity,
    })),
  };
}

/** Découpage déterministe en fenêtres d'environ 1200 caractères. */
export function chunkText(text: string, maxLength = 1200): string[] {
  const cleaned = text.replace(/\r/g, "").trim();
  const paragraphs = cleaned.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  const chunks: string[] = [];
  let buffer = "";

  for (const paragraph of paragraphs) {
    if ((buffer + paragraph).length > maxLength && buffer) {
      chunks.push(buffer.trim());
      buffer = "";
    }
    buffer += `${paragraph}\n\n`;
  }
  if (buffer.trim()) chunks.push(buffer.trim());
  return chunks;
}

/**
 * Indexation d'un document pédagogique (découpage + embeddings).
 * Idempotent : on supprime les chunks existants du document avant ré-insertion.
 */
export async function indexDocument(
  admin: SupabaseClient,
  params: { documentId: string; courseId: string; text: string; title: string },
): Promise<{ chunks: number }> {
  const openai = client();
  const chunks = chunkText(params.text);
  if (chunks.join("").length < 40) throw new Error("DOCUMENT_TOO_SHORT");

  const limited = chunks.slice(0, 200);

  const embeddings = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: limited.map((chunk) => chunk.slice(0, 8000)),
    dimensions: VECTOR_DIMENSIONS,
  });

  const firstVector = embeddings.data[0]?.embedding;
  if (!firstVector || firstVector.length !== VECTOR_DIMENSIONS) {
    throw new Error(`EMBEDDING_DIMENSION_MISMATCH:${firstVector?.length ?? 0}`);
  }

  await admin.from("document_chunks").delete().eq("document_id", params.documentId);

  const rows = limited.map((content, index) => ({
    document_id: params.documentId,
    course_id: params.courseId,
    position: index,
    content: `${params.title} — partie ${index + 1}\n${content}`,
    token_count: Math.ceil(content.length / 4),
    embedding: embeddings.data[index].embedding as unknown as string,
  }));

  const { error } = await admin.from("document_chunks").insert(rows);
  if (error) throw new Error(`INDEX_FAILED:${error.message}`);

  await admin
    .from("course_documents")
    .update({ status: "indexed", chunk_count: rows.length, error: null })
    .eq("id", params.documentId);

  return { chunks: rows.length };
}
