import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/auth";
import { aiErrorMessage, indexDocument, isAiConfigured } from "@/lib/ai/tutor";

/**
 * POST /api/admin/ai/index — construit la base de connaissances du tuteur.
 * ---------------------------------------------------------------------------
 * Réservé aux administrateurs (401 / 403).
 *
 * Modèle de données réel (vérifié en base) :
 *   course_documents (id, course_id, title, storage_path, mime_type, size_bytes,
 *                     status, chunk_count, error)
 *   document_chunks  (document_id, course_id, position, content,
 *                     token_count, embedding vector(1536))
 *   lessons          (module_id, title_fr, content_md) → modules(course_id)
 *
 * Le texte indexé provient du contenu des leçons du cours (seule source
 * réellement rédigée aujourd'hui). Chaque cours sans document reçoit d'abord
 * une fiche documentaire, afin que ses passages soient rattachés à un cours
 * et puissent être retrouvés par la recherche vectorielle.
 *
 * Idempotent : `indexDocument` purge les passages existants avant réinsertion.
 * Sans clé OpenAI : 503 explicite, aucun contenu factice n'est créé.
 */

interface IndexResult {
  courseId: string;
  documentId: string | null;
  title: string;
  chunks: number;
  ok: boolean;
  error?: string;
}

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (user.profile?.role !== "admin") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  if (!isAiConfigured()) {
    return NextResponse.json(
      {
        error: "AI_NOT_CONFIGURED",
        message:
          "Aucune clé IA n'est configurée : l'indexation ne peut pas calculer les vecteurs. Aucun contenu factice n'est créé.",
      },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { limit?: number; force?: boolean }
    | null;
  const limit = Math.min(Math.max(Number(body?.limit ?? 3), 1), 8);
  const force = Boolean(body?.force);

  const admin = createAdminClient();

  // --- 1. Cours disposant de leçons rédigées ------------------------------
  const { data: moduleRows, error: modulesError } = await admin
    .from("modules")
    .select("course_id, lessons(title_fr, content_md, position)")
    .order("position", { ascending: true });

  if (modulesError) {
    return NextResponse.json(
      { error: "QUERY_FAILED", message: modulesError.message },
      { status: 500 },
    );
  }

  const byCourse = new Map<string, { title: string; text: string }>();
  for (const moduleRow of moduleRows ?? []) {
    const courseId = moduleRow.course_id as string;
    const lessons = (moduleRow.lessons ?? []) as Array<{
      title_fr: string;
      content_md: string | null;
      position: number;
    }>;

    const entry = byCourse.get(courseId) ?? { title: "", text: "" };
    entry.text += lessons
      .filter((lesson) => (lesson.content_md ?? "").trim().length > 0)
      .sort((a, b) => a.position - b.position)
      .map((lesson) => `## ${lesson.title_fr}\n\n${lesson.content_md}`)
      .join("\n\n");
    byCourse.set(courseId, entry);
  }

  // Titres des cours concernés
  const courseIds = [...byCourse.keys()];
  if (courseIds.length === 0) {
    return NextResponse.json({
      processed: 0,
      succeeded: 0,
      failed: 0,
      remaining: 0,
      totalChunks: 0,
      results: [],
      message: "Aucune leçon rédigée en base : il n'y a rien à indexer.",
    });
  }

  const { data: courses } = await admin
    .from("courses")
    .select("id, title_fr")
    .in("id", courseIds);

  for (const course of courses ?? []) {
    const entry = byCourse.get(course.id);
    if (entry) entry.title = course.title_fr as string;
  }

  // --- 2. Documents existants ---------------------------------------------
  const { data: existingDocuments } = await admin
    .from("course_documents")
    .select("id, course_id, title, status")
    .in("course_id", courseIds);

  const documentByCourse = new Map(
    (existingDocuments ?? []).map((document) => [document.course_id as string, document]),
  );

  // --- 3. Sélection du travail à faire ------------------------------------
  type Job = { courseId: string; title: string; text: string; documentId: string };
  const jobs: Job[] = [];

  for (const [courseId, entry] of byCourse) {
    if (entry.text.trim().length < 40) continue; // cours sans contenu réel
    const existing = documentByCourse.get(courseId);

    if (existing && existing.status === "indexed" && !force) continue;

    let documentId = existing?.id as string | undefined;

    if (!documentId) {
      const { data: created, error: createError } = await admin
        .from("course_documents")
        .insert({
          course_id: courseId,
          title: `Support de cours — ${entry.title || "cours"}`,
          mime_type: "text/markdown",
          status: "pending",
        })
        .select("id")
        .single();

      if (createError || !created) {
        continue; // on réessaiera au prochain clic
      }
      documentId = created.id as string;
    }

    jobs.push({
      courseId,
      title: entry.title || "Cours",
      text: entry.text,
      documentId: documentId!,
    });
  }

  // --- 4. Indexation par lots ---------------------------------------------
  const results: IndexResult[] = [];

  for (const job of jobs.slice(0, limit)) {
    try {
      const { chunks } = await indexDocument(admin, {
        documentId: job.documentId,
        courseId: job.courseId,
        text: job.text,
        title: job.title,
      });
      results.push({
        courseId: job.courseId,
        documentId: job.documentId,
        title: job.title,
        chunks,
        ok: true,
      });
    } catch (error) {
      const message = aiErrorMessage(error);
      await admin
        .from("course_documents")
        .update({ status: "failed", error: message.slice(0, 300) })
        .eq("id", job.documentId);
      results.push({
        courseId: job.courseId,
        documentId: job.documentId,
        title: job.title,
        chunks: 0,
        ok: false,
        error: message,
      });
    }
  }

  const { count: pending } = await admin
    .from("course_documents")
    .select("id", { count: "exact", head: true })
    .neq("status", "indexed");

  const { count: totalChunks } = await admin
    .from("document_chunks")
    .select("id", { count: "exact", head: true });

  return NextResponse.json({
    processed: results.length,
    succeeded: results.filter((row) => row.ok).length,
    failed: results.filter((row) => !row.ok).length,
    remaining: Math.max((pending ?? 0) - results.filter((row) => row.ok).length, 0),
    totalChunks: totalChunks ?? 0,
    results,
  });
}

/** GET — état de la base de connaissances, sans rien modifier. */
export async function GET() {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (user.profile?.role !== "admin") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: documents } = await admin
    .from("course_documents")
    .select("id, course_id, title, status, chunk_count, error")
    .order("created_at", { ascending: true });

  const rows = documents ?? [];

  // Nombre de cours réellement pourvus de leçons rédigées
  const { data: modules } = await admin
    .from("modules")
    .select("course_id, lessons(content_md)");

  const coursesWithContent = new Set<string>();
  for (const moduleRow of modules ?? []) {
    const lessons = (moduleRow.lessons ?? []) as Array<{ content_md: string | null }>;
    if (lessons.some((lesson) => (lesson.content_md ?? "").trim().length > 0)) {
      coursesWithContent.add(moduleRow.course_id as string);
    }
  }

  return NextResponse.json({
    configured: isAiConfigured(),
    total: Math.max(coursesWithContent.size, rows.length),
    indexed: rows.filter((row) => row.status === "indexed").length,
    pending: Math.max(coursesWithContent.size - rows.filter((r) => r.status === "indexed").length, 0),
    chunks: rows.reduce((sum, row) => sum + (row.chunk_count ?? 0), 0),
    documents: rows,
  });
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;
