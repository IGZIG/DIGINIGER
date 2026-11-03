import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ArrowRight, Award, Clock } from "lucide-react";
import { EmptyState, Progress } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { listMyCourses } from "@/lib/queries";
import { formatDate, formatDuration } from "@/lib/utils";

export const metadata: Metadata = { title: "Mes formations" };
export const dynamic = "force-dynamic";

export default async function MyCoursesPage() {
  const user = await requireUser("/app/mes-formations");
  const courses = await listMyCourses(user.authId);

  const active = courses.filter((row) => row.enrollment.status === "active");
  const completed = courses.filter((row) => row.enrollment.status === "completed");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">En cours ({active.length})</h2>
          <p className="text-sm text-night-400">Reprenez vos formations là où vous les avez laissées.</p>
        </div>
        <ButtonLink href="/app/catalogue" variant="outline" size="sm">
          Ajouter une formation
        </ButtonLink>
      </div>

      {active.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-5 w-5" />}
          title="Aucune formation en cours"
          description="Parcourez le catalogue et inscrivez-vous à une formation gratuite pour démarrer."
          action={<ButtonLink href="/app/catalogue">Explorer le catalogue</ButtonLink>}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {active.map(({ enrollment, course }) => (
            <li key={enrollment.id}>
              <Link
                href={`/app/mes-formations/${course.slug}`}
                className="group flex h-full flex-col rounded-2xl border border-night-100 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-card"
              >
                <div className={`h-2 w-full rounded-full bg-gradient-to-r ${course.cover_gradient}`} aria-hidden />
                <div className="mt-4 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-night-800 group-hover:text-electric-600">
                      {course.title_fr}
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-night-400">{course.school_name_fr}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-night-300 transition-transform group-hover:translate-x-1" aria-hidden />
                </div>
                <div className="mt-4 flex-1" />
                <Progress value={enrollment.progress_pct} label="Progression" tone={enrollment.progress_pct >= 75 ? "green" : "electric"} />
                <p className="mt-3 flex items-center gap-1.5 text-xs text-night-300">
                  <Clock className="h-3 w-3" aria-hidden />
                  Dernière activité : {formatDate(enrollment.last_activity_at)} ·{" "}
                  {formatDuration(Number(course.duration_hours))}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {completed.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Terminées ({completed.length})</h2>
          <ul className="mt-4 divide-y divide-night-100 overflow-hidden rounded-2xl border border-night-100 bg-white">
            {completed.map(({ enrollment, course }) => (
              <li key={enrollment.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{course.title_fr}</p>
                  <p className="text-xs text-night-400">
                    Terminée le {formatDate(enrollment.completed_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="green">
                    <Award className="h-3 w-3" aria-hidden />
                    100 %
                  </Badge>
                  <ButtonLink href={`/app/mes-formations/${course.slug}`} variant="outline" size="sm">
                    Revoir
                  </ButtonLink>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
