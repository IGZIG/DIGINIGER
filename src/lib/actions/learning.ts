"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

/**
 * Server Actions d'apprentissage.
 * La logique métier est dans PostgreSQL (RPC SECURITY DEFINER) : ces actions
 * ne font que relayer l'appel authentifié et traduire les erreurs.
 */

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

const MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: "Veuillez vous connecter pour continuer.",
  COURSE_NOT_AVAILABLE: "Cette formation n'est pas disponible.",
  PAYMENT_REQUIRED: "Cette formation est payante. Choisissez une offre ou achetez la formation.",
  LESSON_NOT_FOUND: "Leçon introuvable.",
  NOT_ENROLLED: "Vous n'êtes pas inscrit à cette formation.",
  EXERCISE_NOT_AVAILABLE: "Cet exercice n'est pas disponible.",
  ATTEMPT_LIMIT_REACHED: "Nombre maximum de tentatives atteint pour cet examen.",
  ATTEMPT_NOT_FOUND: "Tentative introuvable.",
  ATTEMPT_ALREADY_SUBMITTED: "Cette tentative a déjà été soumise.",
  COURSE_NOT_COMPLETED: "Terminez toutes les leçons avant de demander votre certificat.",
  EXAM_NOT_PASSED: "Vous devez réussir tous les examens obligatoires.",
  RATE_LIMITED: "Trop de demandes en peu de temps. Patientez un instant.",
};

function fail(error: { message?: string; code?: string }): ActionResult<never> {
  const raw = error.message ?? "";
  const code = Object.keys(MESSAGES).find((key) => raw.includes(key)) ?? "UNKNOWN";
  return {
    ok: false,
    code,
    message: MESSAGES[code] ?? "Une erreur est survenue. Réessayez.",
  };
}

export async function enrollAction(courseId: string): Promise<ActionResult<{ enrollmentId: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, code: "AUTH_REQUIRED", message: MESSAGES.AUTH_REQUIRED };

  const parsed = z.string().uuid().safeParse(courseId);
  if (!parsed.success) return { ok: false, code: "INVALID", message: "Formation invalide." };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("enroll_in_course", { p_course_id: courseId });

  if (error) return fail(error);

  revalidatePath("/app");
  revalidatePath("/app/mes-formations");
  return { ok: true, data: { enrollmentId: data as string } };
}

export async function completeLessonAction(
  lessonId: string,
  seconds = 0,
): Promise<ActionResult<{ progress: number }>> {
  const supabase = await createServerSupabase();
  const clamped = Math.min(Math.max(Math.floor(seconds), 0), 86400);

  const { data, error } = await supabase.rpc("complete_lesson", {
    p_lesson_id: lessonId,
    p_seconds: clamped,
  });

  if (error) return fail(error);

  const progress = (data as { progress_pct: number } | null)?.progress_pct ?? 0;
  revalidatePath("/app");
  revalidatePath("/app/mes-formations");
  return { ok: true, data: { progress } };
}

export async function startAttemptAction(
  exerciseId: string,
): Promise<ActionResult<{ attemptId: string }>> {
  const parsed = z.string().uuid().safeParse(exerciseId);
  if (!parsed.success) return { ok: false, code: "INVALID", message: "Exercice invalide." };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("start_attempt", { p_exercise_id: exerciseId });
  if (error) return fail(error);

  return { ok: true, data: { attemptId: data as string } };
}

export async function submitAttemptAction(
  attemptId: string,
  answers: Record<string, number | string>,
): Promise<
  ActionResult<{ score: number | null; passed: boolean; correct: number; total: number; pendingReview: boolean }>
> {
  const parsed = z
    .object({
      attemptId: z.string().uuid(),
      answers: z.record(z.union([z.number().int().min(0).max(50), z.string().max(4000)])),
    })
    .safeParse({ attemptId, answers });

  if (!parsed.success) {
    return { ok: false, code: "INVALID", message: "Réponses invalides." };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("submit_attempt", {
    p_attempt_id: attemptId,
    p_answers: answers,
  });

  if (error) return fail(error);

  const result = data as {
    score: number | null;
    passed: boolean;
    correct?: number;
    total?: number;
    pending_review: boolean;
  };

  revalidatePath("/app/evaluations");
  revalidatePath("/app/certificats");

  return {
    ok: true,
    data: {
      score: result.score,
      passed: result.passed,
      correct: result.correct ?? 0,
      total: result.total ?? 0,
      pendingReview: result.pending_review,
    },
  };
}

export async function issueCertificateAction(
  courseId: string,
): Promise<ActionResult<{ serial: string; id: string }>> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("issue_certificate", { p_course_id: courseId });
  if (error) return fail(error);

  const certificate = data as { serial: string; id: string };
  revalidatePath("/app/certificats");
  revalidatePath("/app");

  return { ok: true, data: { serial: certificate.serial, id: certificate.id } };
}
