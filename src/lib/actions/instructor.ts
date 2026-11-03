"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { generateCourseSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/actions/learning";
import type { GeneratedCourseDraft, QuizQuestion } from "@/types/database";

/**
 * Server Actions de l'espace formateur.
 * Aucune de ces actions ne fait confiance au rôle envoyé par le client : le
 * rôle est relu en base (profiles.role) et la RLS vérifie la propriété du cours.
 */

async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) return { error: "AUTH_REQUIRED" as const, user: null };
  const role = user.profile?.role;
  if (role !== "instructor" && role !== "admin") {
    return { error: "FORBIDDEN" as const, user: null };
  }
  return { error: null, user };
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

// ---------------------------------------------------------------------------
// Création / mise à jour d'une formation
// ---------------------------------------------------------------------------
const courseInputSchema = z.object({
  title: z.string().trim().min(6, "Titre trop court").max(140),
  subtitle: z.string().trim().max(220).optional().or(z.literal("")),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  schoolId: z.string().uuid("École requise"),
  level: z.enum(["debutant", "intermediaire", "avance"]),
  priceXof: z.coerce.number().int().min(0).max(1_000_000),
  durationHours: z.coerce.number().min(0.5).max(300),
  outcomes: z.string().max(1000).optional().or(z.literal("")),
  prerequisites: z.string().max(1000).optional().or(z.literal("")),
  audience: z.string().max(1000).optional().or(z.literal("")),
});

function toLines(value?: string | null): string[] {
  return (value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export async function createCourseAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const { error, user } = await requireStaff();
  if (error || !user) return { ok: false, code: error ?? "FORBIDDEN", message: "Accès refusé." };

  const parsed = courseInputSchema.safeParse({
    title: formData.get("title"),
    subtitle: formData.get("subtitle"),
    description: formData.get("description"),
    schoolId: formData.get("schoolId"),
    level: formData.get("level"),
    priceXof: formData.get("priceXof") ?? 0,
    durationHours: formData.get("durationHours") ?? 1,
    outcomes: formData.get("outcomes"),
    prerequisites: formData.get("prerequisites"),
    audience: formData.get("audience"),
  });

  if (!parsed.success) {
    return { ok: false, code: "INVALID", message: parsed.error.errors[0].message };
  }

  const data = parsed.data;
  const supabase = await createServerSupabase();

  // Slug unique : suffixe numérique si nécessaire
  const base = slugify(data.title) || "formation";
  let slug = base;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: existing } = await supabase
      .from("courses")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const { data: course, error: insertError } = await supabase
    .from("courses")
    .insert({
      slug,
      school_id: data.schoolId,
      instructor_id: user.authId,
      title_fr: data.title,
      subtitle_fr: data.subtitle || "",
      description_fr: data.description || data.subtitle || "",
      level: data.level,
      status: "draft",
      price_xof: data.priceXof,
      is_free: data.priceXof === 0,
      duration_hours: data.durationHours,
      outcomes: toLines(data.outcomes),
      prerequisites: toLines(data.prerequisites),
      audience: toLines(data.audience),
    })
    .select("id")
    .single();

  if (insertError || !course) {
    return { ok: false, code: "DB_ERROR", message: "Création impossible : " + insertError?.message };
  }

  revalidatePath("/formateur");
  revalidatePath("/formateur/formations");
  return { ok: true, data: { id: course.id } };
}

export async function updateCourseAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const { error, user } = await requireStaff();
  if (error || !user) return { ok: false, code: error ?? "FORBIDDEN", message: "Accès refusé." };

  const courseId = String(formData.get("courseId") ?? "");
  if (!z.string().uuid().safeParse(courseId).success) {
    return { ok: false, code: "INVALID", message: "Formation invalide." };
  }

  const parsed = courseInputSchema.safeParse({
    title: formData.get("title"),
    subtitle: formData.get("subtitle"),
    description: formData.get("description"),
    schoolId: formData.get("schoolId"),
    level: formData.get("level"),
    priceXof: formData.get("priceXof") ?? 0,
    durationHours: formData.get("durationHours") ?? 1,
    outcomes: formData.get("outcomes"),
    prerequisites: formData.get("prerequisites"),
    audience: formData.get("audience"),
  });

  if (!parsed.success) {
    return { ok: false, code: "INVALID", message: parsed.error.errors[0].message };
  }

  const data = parsed.data;
  const supabase = await createServerSupabase();

  // La RLS n'autorise que le propriétaire (ou l'admin) : le filtre est doublé ici.
  const { error: updateError } = await supabase
    .from("courses")
    .update({
      title_fr: data.title,
      subtitle_fr: data.subtitle || "",
      description_fr: data.description || "",
      school_id: data.schoolId,
      level: data.level,
      price_xof: data.priceXof,
      is_free: data.priceXof === 0,
      duration_hours: data.durationHours,
      outcomes: toLines(data.outcomes),
      prerequisites: toLines(data.prerequisites),
      audience: toLines(data.audience),
    })
    .eq("id", courseId);

  if (updateError) {
    return { ok: false, code: "DB_ERROR", message: "Enregistrement impossible." };
  }

  revalidatePath(`/formateur/formations/${courseId}`);
  revalidatePath("/formateur/formations");
  return { ok: true, data: { id: courseId } };
}

/** Soumet la formation à validation : le formateur ne publie pas lui-même. */
export async function submitCourseForReview(courseId: string): Promise<ActionResult<{ status: string }>> {
  const { error } = await requireStaff();
  if (error) return { ok: false, code: error, message: "Accès refusé." };

  const supabase = await createServerSupabase();
  const { error: updateError } = await supabase
    .from("courses")
    .update({ status: "in_review" })
    .eq("id", courseId)
    .in("status", ["draft"]);

  if (updateError) {
    return { ok: false, code: "DB_ERROR", message: "Soumission impossible." };
  }

  revalidatePath(`/formateur/formations/${courseId}`);
  revalidatePath("/admin/formations");
  return { ok: true, data: { status: "in_review" } };
}

// ---------------------------------------------------------------------------
// Modules et leçons
// ---------------------------------------------------------------------------
export async function addModuleAction(
  courseId: string,
  title: string,
): Promise<ActionResult<{ id: string }>> {
  const { error } = await requireStaff();
  if (error) return { ok: false, code: error, message: "Accès refusé." };

  const parsed = z.string().trim().min(3).max(140).safeParse(title);
  if (!parsed.success) return { ok: false, code: "INVALID", message: "Titre de module invalide." };

  const supabase = await createServerSupabase();
  const { data: last } = await supabase
    .from("modules")
    .select("position")
    .eq("course_id", courseId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error: insertError } = await supabase
    .from("modules")
    .insert({ course_id: courseId, title_fr: parsed.data, position: (last?.position ?? 0) + 1 })
    .select("id")
    .single();

  if (insertError) return { ok: false, code: "DB_ERROR", message: "Ajout impossible." };

  revalidatePath(`/formateur/formations/${courseId}`);
  return { ok: true, data: { id: data.id } };
}

export async function addLessonAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const { error } = await requireStaff();
  if (error) return { ok: false, code: error, message: "Accès refusé." };

  const parsed = z
    .object({
      moduleId: z.string().uuid(),
      title: z.string().trim().min(3).max(160),
      kind: z.enum(["video", "reading", "exercise", "project", "live"]),
      content: z.string().max(20000).optional().or(z.literal("")),
      videoUrl: z.string().url().optional().or(z.literal("")),
      durationMin: z.coerce.number().int().min(1).max(600),
    })
    .safeParse({
      moduleId: formData.get("moduleId"),
      title: formData.get("title"),
      kind: formData.get("kind"),
      content: formData.get("content"),
      videoUrl: formData.get("videoUrl"),
      durationMin: formData.get("durationMin") ?? 10,
    });

  if (!parsed.success) {
    return { ok: false, code: "INVALID", message: parsed.error.errors[0].message };
  }

  const data = parsed.data;
  const supabase = await createServerSupabase();

  const { data: module } = await supabase
    .from("modules")
    .select("course_id")
    .eq("id", data.moduleId)
    .maybeSingle();

  const { data: last } = await supabase
    .from("lessons")
    .select("position")
    .eq("module_id", data.moduleId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: lesson, error: insertError } = await supabase
    .from("lessons")
    .insert({
      module_id: data.moduleId,
      title_fr: data.title,
      kind: data.kind,
      content_md: data.content || "",
      video_url: data.videoUrl || null,
      duration_min: data.durationMin,
      position: (last?.position ?? 0) + 1,
    })
    .select("id")
    .single();

  if (insertError) return { ok: false, code: "DB_ERROR", message: "Ajout impossible." };

  if (module) revalidatePath(`/formateur/formations/${module.course_id}`);
  return { ok: true, data: { id: lesson.id } };
}

export async function deleteLessonAction(lessonId: string): Promise<ActionResult> {
  const { error } = await requireStaff();
  if (error) return { ok: false, code: error, message: "Accès refusé." };

  const supabase = await createServerSupabase();
  const { data: lesson } = await supabase
    .from("lessons")
    .select("module_id, modules(course_id)")
    .eq("id", lessonId)
    .maybeSingle();

  const { error: deleteError } = await supabase.from("lessons").delete().eq("id", lessonId);
  if (deleteError) return { ok: false, code: "DB_ERROR", message: "Suppression impossible." };

  const courseId = (lesson?.modules as { course_id?: string } | null)?.course_id;
  if (courseId) revalidatePath(`/formateur/formations/${courseId}`);
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Exercices (création manuelle d'un quiz)
// ---------------------------------------------------------------------------
export async function createExerciseAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const { error, user } = await requireStaff();
  if (error || !user) return { ok: false, code: error ?? "FORBIDDEN", message: "Accès refusé." };

  const courseId = String(formData.get("courseId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const isExam = formData.get("isExam") === "on";
  const passScore = Number(formData.get("passScore") ?? 60);
  const timeLimit = formData.get("timeLimitMin") ? Number(formData.get("timeLimitMin")) : null;
  const questionsRaw = String(formData.get("questions") ?? "[]");

  if (!z.string().uuid().safeParse(courseId).success || title.length < 4) {
    return { ok: false, code: "INVALID", message: "Données d'exercice invalides." };
  }

  let questions: QuizQuestion[];
  try {
    const parsed = JSON.parse(questionsRaw);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("empty");
    questions = parsed as QuizQuestion[];
  } catch {
    return {
      ok: false,
      code: "INVALID",
      message: "Le format des questions est invalide (JSON attendu).",
    };
  }

  const supabase = await createServerSupabase();
  const { data, error: insertError } = await supabase
    .from("exercises")
    .insert({
      course_id: courseId,
      title_fr: title,
      instructions: String(formData.get("instructions") ?? ""),
      questions,
      pass_score: Math.min(Math.max(passScore, 1), 100),
      time_limit_min: timeLimit,
      is_exam: isExam,
      is_published: false,
      created_by: user.authId,
    })
    .select("id")
    .single();

  if (insertError) return { ok: false, code: "DB_ERROR", message: "Création impossible." };

  revalidatePath(`/formateur/formations/${courseId}`);
  return { ok: true, data: { id: data.id } };
}

export async function toggleExercisePublished(
  exerciseId: string,
  published: boolean,
): Promise<ActionResult> {
  const { error } = await requireStaff();
  if (error) return { ok: false, code: error, message: "Accès refusé." };

  const supabase = await createServerSupabase();
  const { error: updateError } = await supabase
    .from("exercises")
    .update({ is_published: published })
    .eq("id", exerciseId);

  if (updateError) return { ok: false, code: "DB_ERROR", message: "Mise à jour impossible." };

  revalidatePath("/formateur");
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Générateur de formations (brouillon IA modifiable avant publication)
// ---------------------------------------------------------------------------
export async function generateCourseDraftAction(
  formData: FormData,
): Promise<ActionResult<{ generationId: string; draft: GeneratedCourseDraft }>> {
  const { error, user } = await requireStaff();
  if (error || !user) return { ok: false, code: error ?? "FORBIDDEN", message: "Accès refusé." };

  const parsed = generateCourseSchema.safeParse({
    schoolId: formData.get("schoolId"),
    topic: formData.get("topic"),
    level: formData.get("level"),
    durationHours: formData.get("durationHours"),
    audience: formData.get("audience"),
    objectives: formData.get("objectives"),
  });

  if (!parsed.success) {
    return { ok: false, code: "INVALID", message: parsed.error.errors[0].message };
  }

  // La génération est déléguée à une route serveur (accès à la clé du modèle).
  const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/ai/generate-course`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Jeton interne : la route vérifie la session, ce header sert de garde-fou
      "x-internal-action": "generate-course",
    },
    body: JSON.stringify(parsed.data),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      code: payload.error ?? "AI_ERROR",
      message: payload.message ?? "Génération impossible.",
    };
  }

  revalidatePath("/admin/contenus-ia");
  revalidatePath("/formateur/formations");
  return { ok: true, data: { generationId: payload.generationId, draft: payload.draft } };
}

/** Transforme un brouillon validé en formation réelle (statut draft). */
export async function materializeDraftAction(
  generationId: string,
): Promise<ActionResult<{ courseId: string }>> {
  const { error, user } = await requireStaff();
  if (error || !user) return { ok: false, code: error ?? "FORBIDDEN", message: "Accès refusé." };

  const supabase = await createServerSupabase();
  const { data: generation } = await supabase
    .from("course_generations")
    .select("*")
    .eq("id", generationId)
    .maybeSingle();

  if (!generation?.result) {
    return { ok: false, code: "NOT_FOUND", message: "Brouillon introuvable." };
  }

  const draft = generation.result as GeneratedCourseDraft;
  const base = slugify(draft.title) || "formation-ia";

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .insert({
      slug: `${base}-${Math.random().toString(36).slice(2, 6)}`,
      school_id: generation.school_id,
      instructor_id: user.authId,
      title_fr: draft.title,
      subtitle_fr: draft.subtitle,
      description_fr: draft.description,
      level: draft.level,
      status: "draft",
      source: "ai_generated",
      duration_hours: draft.duration_hours,
      outcomes: draft.outcomes ?? [],
      prerequisites: draft.prerequisites ?? [],
      audience: draft.audience ?? [],
    })
    .select("id")
    .single();

  if (courseError || !course) {
    return { ok: false, code: "DB_ERROR", message: "Création de la formation impossible." };
  }

  for (const [moduleIndex, module] of (draft.modules ?? []).entries()) {
    const { data: createdModule } = await supabase
      .from("modules")
      .insert({
        course_id: course.id,
        title_fr: module.title,
        summary: module.summary ?? "",
        position: moduleIndex + 1,
      })
      .select("id")
      .single();

    if (!createdModule) continue;

    const lessons = (module.lessons ?? []).map((lesson, lessonIndex) => ({
      module_id: createdModule.id,
      title_fr: lesson.title,
      kind: lesson.kind,
      content_md: lesson.content_md ?? "",
      duration_min: lesson.duration_min ?? 10,
      position: lessonIndex + 1,
    }));

    if (lessons.length) await supabase.from("lessons").insert(lessons);
  }

  for (const exercise of draft.exercises ?? []) {
    await supabase.from("exercises").insert({
      course_id: course.id,
      title_fr: exercise.title,
      instructions: exercise.instructions ?? "",
      questions: exercise.questions ?? [],
      kind: exercise.kind ?? "quiz",
      is_exam: Boolean(exercise.is_exam),
      is_published: false,
      source: "ai_generated",
      created_by: user.authId,
    });
  }

  await supabase
    .from("course_generations")
    .update({ status: "published", course_id: course.id })
    .eq("id", generationId);

  revalidatePath("/formateur/formations");
  revalidatePath("/admin/contenus-ia");
  return { ok: true, data: { courseId: course.id } };
}
