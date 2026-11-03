import type { Metadata } from "next";
import Link from "next/link";
import { TrendingUp, BookOpen, Award, Target } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Progress, EmptyState } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { listMyAttempts, listMyCourses } from "@/lib/queries";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDate, formatNumber } from "@/lib/utils";
import type { StudentProgressSummary } from "@/types/database";

export const metadata = { title: "Ma progression" };
export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const user = await requireUser("/app/progression");
  const [courses, attempts] = await Promise.all([
    listMyCourses(user.authId),
    listMyAttempts(user.authId),
  ]);

  const supabase = await createServerSupabase();
  const { data: summaryData } = await supabase.rpc("student_progress_summary", {
    p_user_id: user.authId,
  });

  const summary = (summaryData ?? {
    courses_enrolled: 0,
    courses_completed: 0,
    lessons_completed: 0,
    minutes_learned: 0,
    average_score: 0,
    certificates: 0,
  }) as StudentProgressSummary;

  const graded = attempts.filter((attempt) => attempt.score != null);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Formations suivies" value={summary.courses_enrolled} icon={BookOpen} />
        <StatCard
          label="Leçons terminées"
          value={summary.lessons_completed}
          hint={`${formatNumber(summary.minutes_learned)} minutes`}
          icon={TrendingUp}
          tone="gold"
        />
        <StatCard label="Score moyen" value={`${summary.average_score}/100`} icon={Target} tone="green" />
        <StatCard label="Certificats" value={summary.certificates} icon={Award} tone="night" />
      </div>

      <section>
        <h2 className="text-lg font-semibold">Progression par formation</h2>
        {courses.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={<BookOpen className="h-5 w-5" />}
              title="Aucune donnée de progression"
              description="Inscrivez-vous à une formation pour commencer à suivre votre progression."
              action={<ButtonLink href="/app/catalogue">Explorer le catalogue</ButtonLink>}
            />
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {courses.map(({ enrollment, course }) => (
              <li key={enrollment.id} className="rounded-2xl border border-night-100 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/app/mes-formations/${course.slug}`}
                      className="truncate text-sm font-semibold hover:text-electric-600"
                    >
                      {course.title_fr}
                    </Link>
                    <p className="text-xs text-night-400">
                      {course.school_name_fr} · dernière activité le {formatDate(enrollment.last_activity_at)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-night-700">
                    {enrollment.progress_pct} %
                  </span>
                </div>
                <Progress
                  value={enrollment.progress_pct}
                  className="mt-3"
                  tone={enrollment.progress_pct === 100 ? "green" : "electric"}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Résultats des évaluations</h2>
        {graded.length === 0 ? (
          <p className="mt-3 text-sm text-night-400">
            Aucune évaluation corrigée pour le moment.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {graded.slice(0, 10).map((attempt) => (
              <div
                key={attempt.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-night-100 bg-white px-4 py-3"
              >
                <span className="min-w-0 truncate text-sm text-night-700">
                  {attempt.exercise?.title_fr ?? "Évaluation"}
                </span>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="hidden w-32 sm:block">
                    <Progress value={attempt.score ?? 0} tone={(attempt.score ?? 0) >= 60 ? "green" : "gold"} />
                  </div>
                  <span className="w-12 text-right text-sm font-semibold">{attempt.score} %</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
