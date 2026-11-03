import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Users, Star, Wallet, Plus, ArrowRight, FileEdit, Clock } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState, Progress } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { STATUS_LABELS, formatNumber, formatXof, formatDate } from "@/lib/utils";

export const metadata = { title: "Tableau de bord formateur" };
export const dynamic = "force-dynamic";

export default async function InstructorDashboard() {
  const user = await requireRole(["instructor"], "/formateur");
  const supabase = await createServerSupabase();

  const { data: courses } = await supabase
    .from("courses")
    .select("*")
    .eq("instructor_id", user.authId)
    .order("updated_at", { ascending: false });

  const courseIds = (courses ?? []).map((course) => course.id);

  const [{ data: enrollments }, { data: reviewsLike }] = await Promise.all([
    courseIds.length
      ? supabase.from("enrollments").select("course_id, progress_pct, status").in("course_id", courseIds)
      : Promise.resolve({ data: [] as { course_id: string; progress_pct: number; status: string }[] }),
    Promise.resolve({ data: [] }),
  ]);

  const totalStudents = (enrollments ?? []).length;
  const completions = (enrollments ?? []).filter((row) => row.status === "completed").length;
  const published = (courses ?? []).filter((course) => course.status === "published").length;
  const ratingAvg =
    (courses ?? []).filter((course) => Number(course.rating_count) > 0).reduce(
      (sum, course, _index, array) => sum + Number(course.rating_avg) / array.length,
      0,
    ) || 0;

  // Revenus estimés : part formateur (70 %) sur les ventes réelles du mois
  const { data: sales } = courseIds.length
    ? await supabase
        .from("transactions")
        .select("total_xof, course_id, paid_at, status")
        .in("course_id", courseIds)
        .eq("status", "paid")
    : { data: [] };

  const grossXof = (sales ?? []).reduce((sum, row) => sum + row.total_xof, 0);
  const instructorShare = Math.round(grossXof * 0.7);

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-night-800 p-6">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">
            Bonjour {user.profile?.full_name?.split(" ")[0] ?? "formateur"}
          </h2>
          <p className="mt-1 text-sm text-white/60">
            {published} formation{published > 1 ? "s" : ""} publiée{published > 1 ? "s" : ""} ·{" "}
            {totalStudents} apprenant{totalStudents > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/formateur/generateur" variant="gold">
            <Plus className="h-4 w-4" aria-hidden />
            Nouvelle formation
          </ButtonLink>
          <ButtonLink
            href="/formateur/formations"
            variant="outline"
            className="border-white/20 bg-transparent text-white hover:bg-white/10"
          >
            Mes formations
          </ButtonLink>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Formations" value={courses?.length ?? 0} hint={`${published} publiée(s)`} icon={BookOpen} />
        <StatCard label="Apprenants" value={formatNumber(totalStudents)} hint={`${completions} terminé(e)s`} icon={Users} tone="gold" />
        <StatCard label="Note moyenne" value={`${ratingAvg.toFixed(1)}/5`} icon={Star} tone="green" />
        <StatCard
          label="Revenus estimés (70 %)"
          value={formatXof(instructorShare)}
          hint={`${formatXof(grossXof)} de ventes brutes`}
          icon={Wallet}
          tone="night"
        />
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Mes formations</h2>
          <Link href="/formateur/formations" className="text-sm font-medium text-electric-600 hover:underline">
            Tout gérer
          </Link>
        </div>

        {(courses ?? []).length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-5 w-5" />}
            title="Aucune formation pour le moment"
            description="Créez votre première formation manuellement, ou générez un brouillon complet avec l'assistant IA puis ajustez-le."
            action={<ButtonLink href="/formateur/generateur">Créer une formation</ButtonLink>}
          />
        ) : (
          <ul className="space-y-3">
            {(courses ?? []).slice(0, 5).map((course) => {
              const courseEnrollments = (enrollments ?? []).filter((row) => row.course_id === course.id);
              const avgProgress = courseEnrollments.length
                ? Math.round(
                    courseEnrollments.reduce((sum, row) => sum + row.progress_pct, 0) /
                      courseEnrollments.length,
                  )
                : 0;

              return (
                <li key={course.id}>
                  <Link
                    href={`/formateur/formations/${course.id}`}
                    className="group flex flex-wrap items-center gap-4 rounded-2xl border border-night-100 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-card"
                  >
                    <div className={`h-12 w-20 shrink-0 rounded-xl bg-gradient-to-br ${course.cover_gradient}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold group-hover:text-electric-600">
                          {course.title_fr}
                        </p>
                        <Badge
                          tone={
                            course.status === "published"
                              ? "green"
                              : course.status === "in_review"
                                ? "gold"
                                : "neutral"
                          }
                        >
                          {STATUS_LABELS[course.status]}
                        </Badge>
                      </div>
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-night-400">
                        <span>{courseEnrollments.length} apprenant(s)</span>
                        <span aria-hidden>·</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" aria-hidden />
                          modifiée le {formatDate(course.updated_at)}
                        </span>
                      </p>
                      <Progress value={avgProgress} className="mt-2 max-w-xs" tone="electric" />
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-night-300 transition-transform group-hover:translate-x-1" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-night-100 bg-white p-5">
        <div className="flex items-center gap-2">
          <FileEdit className="h-4 w-4 text-night-400" aria-hidden />
          <h2 className="text-sm font-semibold">Rappel du processus de publication</h2>
        </div>
        <ol className="mt-3 grid gap-3 text-sm text-night-500 sm:grid-cols-4">
          {[
            "Créer le brouillon (modules, leçons, exercices)",
            "Soumettre à validation pédagogique",
            "Revue par l'administration DIGINIGER",
            "Publication et ouverture aux apprenants",
          ].map((step, index) => (
            <li key={step} className="rounded-xl bg-mist p-3">
              <span className="text-xs font-bold text-electric-600">0{index + 1}</span>
              <p className="mt-1 text-xs leading-snug">{step}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
