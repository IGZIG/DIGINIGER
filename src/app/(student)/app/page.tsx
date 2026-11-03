import Link from "next/link";
import {
  BookOpen,
  Award,
  Clock,
  Flame,
  ArrowRight,
  Sparkles,
  Trophy,
  CalendarClock,
  ClipboardCheck,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Progress, EmptyState } from "@/components/ui/primitives";
import { Badge as Chip } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { listMyCourses, listMyExams, listMyCertificates } from "@/lib/queries";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatNumber, formatDate } from "@/lib/utils";
import type { StudentProgressSummary } from "@/types/database";

export const metadata = { title: "Tableau de bord" };

interface DashboardPayload {
  summary: StudentProgressSummary;
  plan: { code: string; name_fr: string; ai_messages_per_day: number; current_period_end: string | null } | null;
  ai_today: number;
  recent_activity: { at: string; lesson: string; course: string; slug: string }[];
}

export default async function StudentDashboardPage() {
  const user = await requireUser("/app");
  const supabase = await createServerSupabase();

  const [{ data: dashboard }, myCourses, myExams, myCertificates] = await Promise.all([
    supabase.rpc("student_dashboard"),
    listMyCourses(user.authId),
    listMyExams(user.authId),
    listMyCertificates(user.authId),
  ]);

  const payload = (dashboard ?? {
    summary: {
      courses_enrolled: 0,
      courses_completed: 0,
      lessons_completed: 0,
      minutes_learned: 0,
      average_score: 0,
      certificates: 0,
    },
    plan: null,
    ai_today: 0,
    recent_activity: [],
  }) as DashboardPayload;

  const { summary } = payload;
  const firstName = (user.profile?.full_name || user.email || "").split(" ")[0];
  const inProgress = myCourses.filter((row) => row.enrollment.status === "active").slice(0, 4);
  const upcomingExams = myExams.filter((exam) => exam.is_exam).slice(0, 3);

  const aiLimit = payload.plan?.ai_messages_per_day ?? 10;
  const aiUsed = payload.ai_today ?? 0;

  return (
    <div className="space-y-8">
      {/* Bienvenue */}
      <section className="relative overflow-hidden rounded-3xl bg-night-800 p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 grid-lines opacity-30" aria-hidden />
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-electric-500/25 blur-3xl" aria-hidden />
        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm text-white/50">
              {new Date().toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
            <h2 className="mt-1.5 font-display text-2xl font-semibold text-white">
              Bonjour {firstName || "et bienvenue"} 👋
            </h2>
            <p className="mt-2 max-w-lg text-sm text-white/60">
              {inProgress.length > 0
                ? "Reprenez là où vous vous êtes arrêté — chaque leçon vous rapproche du certificat."
                : "Choisissez votre première formation et commencez dès aujourd'hui."}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <ButtonLink href={inProgress.length ? "/app/mes-formations" : "/app/catalogue"} variant="gold">
              {inProgress.length ? "Continuer" : "Explorer le catalogue"}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </ButtonLink>
            <ButtonLink
              href="/app/tuteur-ia"
              variant="outline"
              className="border-white/20 bg-transparent text-white hover:bg-white/10"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              Tuteur IA
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Indicateurs */}
      <section aria-label="Indicateurs">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Formations suivies"
            value={summary.courses_enrolled}
            hint={`${summary.courses_completed} terminée(s)`}
            icon={BookOpen}
          />
          <StatCard
            label="Leçons terminées"
            value={summary.lessons_completed}
            hint={`${formatNumber(summary.minutes_learned)} minutes d'apprentissage`}
            icon={Flame}
            tone="gold"
          />
          <StatCard
            label="Score moyen"
            value={`${summary.average_score}/100`}
            hint="Sur les évaluations corrigées"
            icon={Trophy}
            tone="green"
          />
          <StatCard
            label="Certificats"
            value={summary.certificates}
            hint="Vérifiables publiquement"
            icon={Award}
            tone="night"
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Reprendre les cours */}
        <section className="lg:col-span-2" aria-labelledby="reprendre">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="reprendre" className="text-lg font-semibold">
              Reprendre l&apos;apprentissage
            </h2>
            <Link href="/app/mes-formations" className="text-sm font-medium text-electric-600 hover:underline">
              Tout voir
            </Link>
          </div>

          {inProgress.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="h-5 w-5" />}
              title="Aucune formation en cours"
              description="Explorez le catalogue et inscrivez-vous à une formation gratuite pour commencer immédiatement."
              action={<ButtonLink href="/app/catalogue">Explorer le catalogue</ButtonLink>}
            />
          ) : (
            <ul className="space-y-3">
              {inProgress.map(({ enrollment, course }) => (
                <li key={enrollment.id}>
                  <Link
                    href={`/app/mes-formations/${course.slug}`}
                    className="group flex items-center gap-4 rounded-2xl border border-night-100 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-card"
                  >
                    <div
                      className={`hidden h-16 w-24 shrink-0 rounded-xl bg-gradient-to-br ${course.cover_gradient} sm:block`}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-night-800 group-hover:text-electric-600">
                        {course.title_fr}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-night-400">
                        {course.school_name_fr} · {course.lesson_count} leçons
                      </p>
                      <Progress
                        value={enrollment.progress_pct}
                        className="mt-2.5"
                        label="Progression"
                        tone={enrollment.progress_pct >= 75 ? "green" : "electric"}
                      />
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-night-300 transition-transform group-hover:translate-x-1 group-hover:text-electric-500" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Colonne latérale */}
        <div className="space-y-6">
          {/* Tuteur IA */}
          <section className="rounded-2xl border border-night-100 bg-white p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold-50 text-gold-600">
                <Sparkles className="h-4 w-4" aria-hidden />
              </span>
              <h2 className="text-sm font-semibold">Tuteur IA</h2>
            </div>
            <p className="mt-3 text-2xl font-bold">
              {aiUsed}
              <span className="text-sm font-normal text-night-400"> / {aiLimit} messages</span>
            </p>
            <Progress value={(aiUsed / Math.max(aiLimit, 1)) * 100} className="mt-2" tone="gold" />
            <p className="mt-2 text-xs text-night-300">
              Quota quotidien de votre offre {payload.plan?.name_fr ?? "Gratuit"}.
            </p>
            <ButtonLink href="/app/tuteur-ia" size="sm" className="mt-4 w-full">
              Poser une question
            </ButtonLink>
          </section>

          {/* Examens */}
          <section className="rounded-2xl border border-night-100 bg-white p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-electric-50 text-electric-600">
                <ClipboardCheck className="h-4 w-4" aria-hidden />
              </span>
              <h2 className="text-sm font-semibold">Évaluations</h2>
            </div>
            {upcomingExams.length === 0 ? (
              <p className="mt-3 text-sm text-night-400">
                Aucun examen disponible pour le moment. Ils apparaissent dès que vous êtes inscrit
                à une formation publiée.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {upcomingExams.map((exam) => (
                  <li key={exam.id}>
                    <Link
                      href={`/app/evaluations/${exam.id}`}
                      className="block rounded-xl border border-night-100 px-3 py-2.5 transition-colors hover:border-electric-200 hover:bg-electric-50/40"
                    >
                      <p className="truncate text-xs font-semibold text-night-700">{exam.title_fr}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-night-400">
                        <CalendarClock className="h-3 w-3" aria-hidden />
                        {exam.time_limit_min ? `${exam.time_limit_min} min` : "Sans limite"} · Seuil{" "}
                        {exam.pass_score}/100
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Certificats */}
          <section className="rounded-2xl border border-night-100 bg-white p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Award className="h-4 w-4" aria-hidden />
              </span>
              <h2 className="text-sm font-semibold">Derniers certificats</h2>
            </div>
            {myCertificates.length === 0 ? (
              <p className="mt-3 text-sm text-night-400">
                Vos certificats apparaîtront ici, avec leur numéro de vérification.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {myCertificates.slice(0, 3).map((certificate) => (
                  <li key={certificate.id} className="rounded-xl bg-mist px-3 py-2.5">
                    <p className="truncate text-xs font-semibold text-night-700">
                      {certificate.course_title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-night-400">
                      {formatDate(certificate.issued_at)} ·{" "}
                      <span className="font-mono">{certificate.serial}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <ButtonLink href="/app/certificats" variant="outline" size="sm" className="mt-4 w-full">
              Mes certificats
            </ButtonLink>
          </section>
        </div>
      </div>

      {/* Activité récente */}
      <section aria-labelledby="activite">
        <h2 id="activite" className="mb-4 text-lg font-semibold">
          Activité récente
        </h2>
        {payload.recent_activity.length === 0 ? (
          <EmptyState
            icon={<Clock className="h-5 w-5" />}
            title="Pas encore d'activité"
            description="Votre historique d'apprentissage s'affichera ici dès votre première leçon terminée."
          />
        ) : (
          <ul className="divide-y divide-night-100 overflow-hidden rounded-2xl border border-night-100 bg-white">
            {payload.recent_activity.map((item, index) => (
              <li key={`${item.at}-${index}`} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-night-700">{item.lesson}</p>
                  <p className="truncate text-xs text-night-400">{item.course}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Chip tone="green">Terminée</Chip>
                  <span className="hidden text-xs text-night-300 sm:block">{formatDate(item.at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
