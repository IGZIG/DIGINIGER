import type { Metadata } from "next";
import { CourseCard } from "@/components/marketing/course-card";
import { listPublicCourses, listSchools } from "@/lib/queries";
import { CourseFiltersBar } from "@/components/marketing/course-filters";
import { Suspense } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Catalogue" };
export const dynamic = "force-dynamic";

export default async function StudentCataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ecole?: string; niveau?: string; tri?: string; prix?: string }>;
}) {
  const user = await requireUser("/app/catalogue");
  const params = await searchParams;

  const [schools, courses] = await Promise.all([
    listSchools(),
    listPublicCourses({
      search: params.q,
      school: params.ecole,
      level: params.niveau,
      sort: (params.tri as "popular" | "rating" | "priceAsc" | "priceDesc" | "duration") ?? "popular",
      maxPrice: params.prix ? Number(params.prix) : undefined,
    }),
  ]);

  // Marque les formations déjà suivies
  const supabase = await createServerSupabase();
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("course_id")
    .eq("user_id", user.authId);
  const enrolledIds = new Set((enrollments ?? []).map((row) => row.course_id));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Catalogue des formations</h2>
        <p className="text-sm text-night-400">
          {courses.length} formations disponibles · inscrivez-vous en un clic aux formations gratuites.
        </p>
      </div>

      <Suspense fallback={<div className="h-40 animate-pulse rounded-3xl bg-white" />}>
        <CourseFiltersBar schools={schools} total={courses.length} />
      </Suspense>

      {courses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-night-200 bg-white p-10 text-center">
          <p className="text-sm text-night-500">Aucune formation ne correspond à ces filtres.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <div key={course.id} className="relative">
              {enrolledIds.has(course.id) && (
                <div className="absolute right-3 top-3 z-10">
                  <Badge tone="green">Inscrit</Badge>
                </div>
              )}
              <CourseCard course={course} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
