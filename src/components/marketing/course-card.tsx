import Link from "next/link";
import { Clock, Users, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Rating } from "@/components/ui/primitives";
import { formatDuration, formatNumber, formatXof, LEVEL_LABELS } from "@/lib/utils";
import type { PublicCourse } from "@/types/database";

/**
 * Carte de formation du catalogue public.
 * Le dégradé de couverture provient de la base (cover_gradient) : aucune image
 * externe n'est nécessaire, la carte reste rapide et responsive.
 */
export function CourseCard({ course }: { course: PublicCourse }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-night-100 bg-white shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
      <Link href={`/formations/${course.slug}`} className="block">
        <div
          className={`relative flex h-40 items-end bg-gradient-to-br ${course.cover_gradient} p-4`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.22),transparent_55%)]" />
          <div className="relative flex w-full items-end justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {course.school_name_fr && (
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                  {course.school_name_fr}
                </span>
              )}
            </div>
            {course.is_free ? (
              <Badge tone="green" className="border-transparent bg-white/90">
                Gratuit
              </Badge>
            ) : (
              <span className="rounded-full bg-night-900/70 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                {formatXof(course.price_xof)}
              </span>
            )}
          </div>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <Badge tone="neutral">{LEVEL_LABELS[course.level]}</Badge>
          <Rating value={Number(course.rating_avg)} count={course.rating_count} />
        </div>

        <h3 className="text-base font-semibold leading-snug">
          <Link href={`/formations/${course.slug}`} className="hover:text-electric-600">
            {course.title_fr}
          </Link>
        </h3>

        <p className="mt-1.5 line-clamp-2 text-sm text-night-400">{course.subtitle_fr}</p>

        <p className="mt-3 text-xs font-medium text-night-500">
          {course.instructor_name ?? "Formateur DIGINIGER"}
        </p>

        <dl className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-night-100 pt-3 text-xs text-night-400">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            <dt className="sr-only">Durée</dt>
            <dd>{formatDuration(Number(course.duration_hours))}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" aria-hidden />
            <dt className="sr-only">Leçons</dt>
            <dd>{course.lesson_count} leçons</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" aria-hidden />
            <dt className="sr-only">Apprenants</dt>
            <dd>{formatNumber(course.enrollment_count)}</dd>
          </div>
        </dl>

        <Link
          href={`/formations/${course.slug}`}
          className="mt-4 inline-flex items-center justify-center rounded-full border border-night-200 px-4 py-2.5 text-sm font-medium text-night-700 transition-colors group-hover:border-electric-500 group-hover:bg-electric-500 group-hover:text-white"
        >
          Voir la formation
        </Link>
      </div>
    </article>
  );
}

export function CourseCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-night-100 bg-white p-4">
      <div className="skeleton mb-4 h-36 w-full rounded-2xl" />
      <div className="skeleton mb-2 h-3 w-20" />
      <div className="skeleton mb-2 h-4 w-4/5" />
      <div className="skeleton mb-4 h-3 w-3/5" />
      <div className="skeleton h-9 w-full rounded-full" />
    </div>
  );
}
