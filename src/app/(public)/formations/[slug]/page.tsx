import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Clock,
  Users,
  Layers,
  CheckCircle2,
  PlayCircle,
  FileText,
  PenLine,
  Award,
  Globe,
  ShieldCheck,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Rating, Progress } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { EnrollButton } from "@/components/dashboard/enroll-button";
import { CourseCard } from "@/components/marketing/course-card";
import { getCurrentUser } from "@/lib/auth";
import {
  getCourseCurriculum,
  getMyEnrollment,
  getPublicCourseBySlug,
  listPublicCourses,
} from "@/lib/queries";
import { formatDuration, formatNumber, formatXof, LEVEL_LABELS } from "@/lib/utils";

const LESSON_ICONS = {
  video: PlayCircle,
  reading: FileText,
  exercise: PenLine,
  project: Layers,
  live: Users,
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = await getPublicCourseBySlug(slug);
  if (!course) return { title: "Formation introuvable" };

  return {
    title: course.title_fr,
    description: course.subtitle_fr,
    openGraph: { title: course.title_fr, description: course.subtitle_fr },
  };
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = await getPublicCourseBySlug(slug);

  if (!course) notFound();

  const [curriculum, user, similar] = await Promise.all([
    getCourseCurriculum(course.id),
    getCurrentUser(),
    listPublicCourses({ school: course.school_slug ?? undefined, limit: 4 }),
  ]);

  const enrollment = user ? await getMyEnrollment(user.authId, course.id) : null;
  const isEnrolled = Boolean(enrollment && enrollment.status !== "cancelled");

  const totalMinutes = curriculum.lessons.reduce((sum, lesson) => sum + lesson.duration_min, 0);
  const alternatives = similar.filter((item) => item.id !== course.id).slice(0, 3);

  return (
    <div className="bg-mist/40">
      {/* En-tête */}
      <div className="bg-night-900 pb-16 pt-8 text-white">
        <div className="container-page">
          <nav aria-label="Fil d'Ariane" className="mb-6 flex items-center gap-1.5 text-xs text-white/40">
            <Link href="/" className="hover:text-white">Accueil</Link>
            <ChevronRight className="h-3 w-3" aria-hidden />
            <Link href="/formations" className="hover:text-white">Formations</Link>
            {course.school_slug && (
              <>
                <ChevronRight className="h-3 w-3" aria-hidden />
                <Link href={`/ecoles/${course.school_slug}`} className="hover:text-white">
                  {course.school_name_fr}
                </Link>
              </>
            )}
          </nav>

          <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
            <div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
                  {course.school_name_fr}
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
                  {LEVEL_LABELS[course.level]}
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
                  {course.language === "fr" ? "Français" : "Anglais"}
                </span>
              </div>

              <h1 className="mt-5 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
                {course.title_fr}
              </h1>
              <p className="mt-3 max-w-2xl text-white/60">{course.subtitle_fr}</p>

              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-white/60">
                <span className="flex items-center gap-1.5">
                  <Star /> {(Number(course.rating_avg)).toFixed(1)} ({course.rating_count} avis)
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" aria-hidden />
                  {formatNumber(course.enrollment_count)} apprenants
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" aria-hidden />
                  {formatDuration(Number(course.duration_hours))}
                </span>
                <span className="flex items-center gap-1.5">
                  <Layers className="h-4 w-4" aria-hidden />
                  {curriculum.modules.length} modules · {curriculum.lessons.length} leçons
                </span>
              </div>

              <p className="mt-5 text-sm text-white/50">
                Formateur :{" "}
                <span className="font-medium text-white">
                  {course.instructor_name ?? "Équipe pédagogique DIGINIGER"}
                </span>
              </p>
            </div>

            {/* Carte d'achat */}
            <aside className="lg:-mb-28">
              <div className="rounded-3xl border border-night-100 bg-white p-6 shadow-lift">
                <div
                  className={`mb-5 flex h-32 items-center justify-center rounded-2xl bg-gradient-to-br ${course.cover_gradient}`}
                >
                  {course.is_free ? (
                    <Badge tone="green" className="border-transparent bg-white/90">Gratuit</Badge>
                  ) : (
                    <span className="font-display text-2xl font-bold text-white">
                      {formatXof(course.price_xof)}
                    </span>
                  )}
                </div>

                {isEnrolled && (
                  <div className="mb-4">
                    <Progress
                      value={enrollment?.progress_pct ?? 0}
                      label="Votre progression"
                      tone="green"
                    />
                  </div>
                )}

                <EnrollButton
                  courseId={course.id}
                  slug={course.slug}
                  isFree={course.is_free || course.price_xof === 0}
                  isEnrolled={isEnrolled}
                  priceLabel={formatXof(course.price_xof)}
                />

                <ul className="mt-6 space-y-2.5 border-t border-night-100 pt-5 text-sm text-night-500">
                  {[
                    "Accès illimité à vie",
                    "Tuteur IA sur le contenu du cours",
                    "Exercices corrigés automatiquement",
                    "Certificat vérifiable par QR code",
                    "Accès mobile et faible bande passante",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>

                <div className="mt-5 flex items-center gap-2 rounded-xl bg-mist px-3 py-2.5 text-xs text-night-400">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-electric-500" aria-hidden />
                  Paiement vérifié côté serveur. Aucun débit sans confirmation.
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Corps */}
      <div className="container-page grid gap-10 py-12 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-10">
          <section>
            <h2 className="text-xl font-semibold">Ce que vous allez apprendre</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {course.outcomes.map((outcome) => (
                <li key={outcome} className="flex items-start gap-2.5 rounded-2xl border border-night-100 bg-white p-4 text-sm text-night-600">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                  {outcome}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Programme</h2>
            <p className="mt-1 text-sm text-night-400">
              {curriculum.modules.length} modules · {curriculum.lessons.length} leçons ·{" "}
              {Math.round(totalMinutes / 60)} h de contenu
            </p>

            <div className="mt-5 divide-y divide-night-100 overflow-hidden rounded-3xl border border-night-100 bg-white">
              {curriculum.modules.map((module, moduleIndex) => {
                const moduleLessons = curriculum.lessons.filter((lesson) => lesson.module_id === module.id);
                return (
                  <details key={module.id} open={moduleIndex === 0} className="group">
                    <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 hover:bg-mist/60">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-electric-50 text-xs font-bold text-electric-700">
                          {moduleIndex + 1}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-night-800">{module.title_fr}</p>
                          <p className="text-xs text-night-400">
                            {moduleLessons.length} leçons ·{" "}
                            {moduleLessons.reduce((sum, lesson) => sum + lesson.duration_min, 0)} min
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-night-300 transition-transform group-open:rotate-90" aria-hidden />
                    </summary>
                    <ul className="border-t border-night-100 bg-mist/30">
                      {moduleLessons.map((lesson) => {
                        const Icon = LESSON_ICONS[lesson.kind] ?? PlayCircle;
                        return (
                          <li key={lesson.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                            <Icon className="h-4 w-4 shrink-0 text-night-300" aria-hidden />
                            <span className="flex-1 text-night-600">{lesson.title_fr}</span>
                            {lesson.is_preview && <Badge tone="electric">Aperçu</Badge>}
                            <span className="text-xs text-night-300">{lesson.duration_min} min</span>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Prérequis</h2>
            <ul className="mt-3 space-y-2 text-sm text-night-500">
              {course.prerequisites.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-electric-500" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">À qui s&apos;adresse cette formation</h2>
            <ul className="mt-3 space-y-2 text-sm text-night-500">
              {course.audience.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Colonne latérale */}
        <aside className="space-y-6">
          <section className="rounded-3xl border border-night-100 bg-white p-6">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-gold-500" aria-hidden />
              <h2 className="text-base font-semibold">Certificat de réussite</h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-night-400">
              Terminez toutes les leçons et réussissez les examens pour obtenir un certificat
              DIGINIGER avec numéro unique et QR code de vérification.
            </p>
            <ButtonLink href="/verifier-certificat" variant="outline" size="sm" className="mt-4 w-full">
              Vérifier un certificat
            </ButtonLink>
          </section>

          <section className="rounded-3xl border border-electric-100 bg-electric-50/60 p-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-electric-600" aria-hidden />
              <h2 className="text-base font-semibold">Tuteur IA inclus</h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-night-500">
              Posez vos questions sur le contenu du cours : le tuteur répond en s&apos;appuyant sur
              les documents validés par le formateur.
            </p>
          </section>

          <section className="rounded-3xl border border-night-100 bg-white p-6">
            <div className="flex items-center gap-2 text-sm text-night-500">
              <Globe className="h-4 w-4" aria-hidden />
              Langue : {course.language === "fr" ? "Français" : "Anglais"}
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm text-night-500">
              <Clock className="h-4 w-4" aria-hidden />
              Durée estimée : {formatDuration(Number(course.duration_hours))}
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm text-night-500">
              <Rating value={Number(course.rating_avg)} count={course.rating_count} />
            </div>
          </section>
        </aside>
      </div>

      {alternatives.length > 0 && (
        <div className="container-page pb-16">
          <h2 className="mb-6 text-xl font-semibold">Formations similaires</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {alternatives.map((item) => (
              <CourseCard key={item.id} course={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Star() {
  return <span className="text-gold-400" aria-hidden>★</span>;
}
