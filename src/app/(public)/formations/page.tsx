import type { Metadata } from "next";
import { Search } from "lucide-react";
import { CourseCard } from "@/components/marketing/course-card";
import { EmptyState, SectionTitle } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { CourseFiltersBar } from "@/components/marketing/course-filters";
import { Suspense } from "react";
import { listPublicCourses, listSchools } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Catalogue des formations",
  description:
    "Explorez les formations professionnelles DIGINIGER : IA, business, agriculture, finance, marketing et métiers techniques.",
};

type SearchParams = Promise<{
  q?: string;
  ecole?: string;
  niveau?: string;
  tri?: string;
  prix?: string;
}>;

export default async function CoursesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [schools, courses] = await Promise.all([
    listSchools(),
    listPublicCourses({
      search: params.q,
      school: params.ecole,
      level: params.niveau,
      sort:
        (params.tri as "popular" | "rating" | "priceAsc" | "priceDesc" | "duration") ?? "popular",
      maxPrice: params.prix ? Number(params.prix) : undefined,
    }),
  ]);

  return (
    <div className="bg-mist/50">
      <div className="border-b border-night-100 bg-white">
        <div className="container-page py-12">
          <SectionTitle
            eyebrow="Catalogue"
            title="Trouvez la formation qui fera la différence."
            description="Des parcours professionnels conçus avec des praticiens, accessibles depuis Niamey, Zinder ou en mobilité."
          />
        </div>
      </div>

      <div className="container-page py-10">
        <Suspense fallback={<div className="h-40 animate-pulse rounded-3xl bg-white" />}>
          <CourseFiltersBar schools={schools} total={courses.length} />
        </Suspense>

        {courses.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              icon={<Search className="h-5 w-5" />}
              title="Aucune formation ne correspond à votre recherche"
              description="Essayez d'élargir vos filtres, ou explorez l'ensemble du catalogue."
              action={
                <ButtonLink href="/formations" variant="outline">
                  Réinitialiser les filtres
                </ButtonLink>
              }
            />
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}

        {courses.length > 0 && (
          <p className="mt-10 text-center text-sm text-night-400">
            {courses.length} formation{courses.length > 1 ? "s" : ""} affichée
            {courses.length > 1 ? "s" : ""}
          </p>
        )}
      </div>
    </div>
  );
}
