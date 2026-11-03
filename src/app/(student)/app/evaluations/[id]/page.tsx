import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ExamRunner } from "@/components/dashboard/exam-runner";
import { getSafeExercise } from "@/lib/queries";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import type { Attempt } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function ExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/app/evaluations/${id}`);

  const exercise = await getSafeExercise(id);
  if (!exercise) notFound();

  const supabase = await createServerSupabase();
  const { data: attempts } = await supabase
    .from("attempts")
    .select("id, score, status, submitted_at, feedback")
    .eq("user_id", user.authId)
    .eq("exercise_id", id)
    .order("started_at", { ascending: false });

  return (
    <div className="space-y-5">
      <Link
        href="/app/evaluations"
        className="inline-flex items-center gap-1 text-xs font-medium text-night-400 hover:text-night-700"
      >
        <ChevronLeft className="h-3 w-3" aria-hidden />
        Toutes les évaluations
      </Link>

      <ExamRunner
        exercise={exercise}
        existingAttempts={(attempts ?? []) as Pick<Attempt, "id" | "score" | "status" | "submitted_at" | "feedback">[]}
      />

      {(attempts ?? []).some((a) => a.feedback) && (
        <section className="rounded-2xl border border-night-100 bg-white p-5">
          <h2 className="text-sm font-semibold">Retours de correction</h2>
          <ul className="mt-3 space-y-2 text-sm text-night-500">
            {(attempts ?? [])
              .filter((attempt) => attempt.feedback)
              .slice(0, 5)
              .map((attempt) => (
                <li key={attempt.id} className="rounded-xl bg-mist px-3 py-2">
                  {attempt.feedback}
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
