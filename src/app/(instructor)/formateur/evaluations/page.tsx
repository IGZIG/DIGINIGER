import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Attempt, Exercise } from "@/types/database";

export const metadata: Metadata = { title: "Évaluations (formateur)" };
export const dynamic = "force-dynamic";

export default async function InstructorAssessmentsPage() {
  const user = await requireRole(["instructor"], "/formateur/evaluations");
  const supabase = await createServerSupabase();

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title_fr")
    .eq("instructor_id", user.authId);

  const courseIds = (courses ?? []).map((course) => course.id);

  const { data: exercises } = courseIds.length
    ? await supabase
        .from("exercises")
        .select("*")
        .in("course_id", courseIds)
        .order("created_at", { ascending: false })
    : { data: [] as Exercise[] };

  const exerciseIds = (exercises ?? []).map((exercise) => exercise.id);

  const { data: attempts } = exerciseIds.length
    ? await supabase
        .from("attempts")
        .select("*")
        .in("exercise_id", exerciseIds)
        .order("started_at", { ascending: false })
        .limit(100)
    : { data: [] as Attempt[] };

  const courseTitles = new Map((courses ?? []).map((course) => [course.id, course.title_fr]));
  const pendingReview = (attempts ?? []).filter((attempt) => attempt.status === "submitted");

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold">Mes évaluations ({(exercises ?? []).length})</h2>
        <p className="text-sm text-night-400">
          Les QCM sont corrigés automatiquement. Les travaux rendus (projets, questions ouvertes)
          apparaissent en attente d&apos;évaluation.
        </p>

        {(exercises ?? []).length === 0 ? (
          <div className="mt-5">
            <EmptyState
              icon={<ClipboardList className="h-5 w-5" />}
              title="Aucune évaluation"
              description="Ajoutez une évaluation depuis l'éditeur d'une formation."
              action={<ButtonLink href="/formateur/formations" variant="outline">Mes formations</ButtonLink>}
            />
          </div>
        ) : (
          <ul className="mt-5 space-y-2">
            {(exercises as Exercise[]).map((exercise) => (
              <li
                key={exercise.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-night-100 bg-white p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{exercise.title_fr}</p>
                  <p className="text-xs text-night-400">
                    {courseTitles.get(exercise.course_id) ?? "Formation"} · {exercise.questions.length} questions
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {exercise.is_exam && <Badge tone="night">Examen</Badge>}
                  <Badge tone={exercise.is_published ? "green" : "neutral"}>
                    {exercise.is_published ? "Publié" : "Brouillon"}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Tentatives en attente de correction ({pendingReview.length})</h2>
        {pendingReview.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-white p-4 text-sm text-night-400">Aucune copie en attente.</p>
        ) : (
          <ul className="mt-3 divide-y divide-night-100 overflow-hidden rounded-2xl border border-night-100 bg-white">
            {pendingReview.map((attempt) => (
              <li key={attempt.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="text-night-600">
                  Tentative du{" "}
                  {new Date(attempt.submitted_at ?? attempt.started_at).toLocaleDateString("fr-FR")}
                </span>
                <Badge tone="gold">À évaluer</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
