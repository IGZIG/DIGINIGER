import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Target, Briefcase, Wrench } from "lucide-react";
import { CourseCard } from "@/components/marketing/course-card";
import { SchoolIcon } from "@/components/marketing/school-icon";
import { EmptyState } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { getSchoolBySlug, listPublicCourses, listSchools } from "@/lib/queries";
import { formatNumber } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const school = await getSchoolBySlug(slug);
  if (!school) return { title: "École introuvable" };
  return { title: school.name_fr, description: school.description_fr };
}

export const revalidate = 300;

export default async function SchoolDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const school = await getSchoolBySlug(slug);
  if (!school) notFound();

  const [courses, allSchools] = await Promise.all([
    listPublicCourses({ school: slug, limit: 30 }),
    listSchools(),
  ]);

  const totalStudents = courses.reduce((sum, course) => sum + course.enrollment_count, 0);
  const others = allSchools.filter((item) => item.slug !== slug).slice(0, 3);

  return (
    <div>
      <section className="relative overflow-hidden bg-night-900 py-14 text-white">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full blur-3xl"
          style={{ backgroundColor: `${school.accent}30` }}
          aria-hidden
        />
        <div className="container-page relative">
          <Link
            href="/ecoles"
            className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Toutes les écoles
          </Link>

          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
            <span
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${school.accent}22`, color: school.accent }}
            >
              <SchoolIcon name={school.icon} className="h-8 w-8" />
            </span>
            <div>
              <h1 className="font-display text-3xl font-semibold text-white sm:text-4xl">
                {school.name_fr}
              </h1>
              <p className="mt-2 text-lg text-white/60">{school.tagline_fr}</p>
            </div>
          </div>

          <p className="mt-6 max-w-3xl text-white/60">{school.description_fr}</p>

          <dl className="mt-8 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-3">
            {[
              { label: "Formations", value: courses.length },
              { label: "Apprenants", value: formatNumber(totalStudents) },
              { label: "Niveau", value: "Débutant à avancé" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <dt className="text-xs uppercase tracking-wider text-white/40">{stat.label}</dt>
                <dd className="mt-1 font-display text-xl font-bold text-white">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="container-page py-12">
        <h2 className="text-xl font-semibold">Formations de cette école</h2>
        {courses.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={<Target className="h-5 w-5" />}
              title="Aucune formation publiée pour le moment"
              description="Cette école prépare ses premiers parcours. Explorez les autres écoles en attendant."
              action={<ButtonLink href="/formations" variant="outline">Voir le catalogue</ButtonLink>}
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}

        <section className="mt-14 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-night-100 bg-white p-6">
            <Wrench className="h-5 w-5 text-electric-600" aria-hidden />
            <h3 className="mt-3 font-semibold">Compétences visées</h3>
            <p className="mt-1.5 text-sm text-night-400">
              Des compétences opérationnelles, évaluées par des exercices et un projet final, pas
              seulement des notions théoriques.
            </p>
          </div>
          <div className="rounded-3xl border border-night-100 bg-white p-6">
            <Briefcase className="h-5 w-5 text-gold-500" aria-hidden />
            <h3 className="mt-3 font-semibold">Débouchés</h3>
            <p className="mt-1.5 text-sm text-night-400">
              Chaque parcours précise les métiers et missions accessibles à l&apos;issue de la
              formation, avec un certificat vérifiable.
            </p>
          </div>
        </section>

        {others.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-5 text-xl font-semibold">Découvrir les autres écoles</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {others.map((item) => (
                <Link
                  key={item.id}
                  href={`/ecoles/${item.slug}`}
                  className="flex items-center gap-3 rounded-2xl border border-night-100 bg-white p-4 transition-colors hover:border-electric-200"
                >
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${item.accent}14`, color: item.accent }}
                  >
                    <SchoolIcon name={item.icon} className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-medium text-night-700">{item.name_fr}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
