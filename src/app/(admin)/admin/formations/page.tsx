import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ExternalLink } from "lucide-react";
import { EmptyState } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { CourseReviewActions } from "@/components/dashboard/admin-actions";
import { requireRole } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { STATUS_LABELS, formatDate, formatXof } from "@/lib/utils";

export const metadata: Metadata = { title: "Formations (admin)" };
export const dynamic = "force-dynamic";

interface AdminCourseRow {
  id: string;
  slug: string;
  title_fr: string;
  status: keyof typeof STATUS_LABELS;
  source: string;
  price_xof: number;
  is_free: boolean;
  updated_at: string;
  school: { name_fr?: string } | null;
  instructor: { full_name?: string } | null;
}

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>;
}) {
  await requireRole(["admin"], "/admin/formations");
  const { statut } = await searchParams;
  const supabase = await createServerSupabase();

  let query = supabase
    .from("courses")
    .select(
      "id, slug, title_fr, status, source, price_xof, is_free, updated_at, school:schools(name_fr), instructor:profiles!courses_instructor_id_fkey(full_name)",
    )
    .order("updated_at", { ascending: false })
    .limit(100);

  if (statut && ["draft", "in_review", "published", "archived"].includes(statut)) {
    query = query.eq("status", statut);
  }

  const { data } = await query;
  const courses = (data ?? []) as unknown as AdminCourseRow[];

  const filters = [
    { value: "", label: "Toutes" },
    { value: "in_review", label: "À valider" },
    { value: "published", label: "Publiées" },
    { value: "draft", label: "Brouillons" },
    { value: "archived", label: "Archivées" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Formations ({courses.length})</h2>
          <p className="text-sm text-night-400">
            Validation éditoriale : une formation ne peut être publiée que si elle contient des leçons.
          </p>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Filtrer par statut">
        {filters.map((filter) => (
          <Link
            key={filter.value}
            href={filter.value ? `/admin/formations?statut=${filter.value}` : "/admin/formations"}
            className={
              (statut ?? "") === filter.value
                ? "rounded-full bg-night-800 px-3.5 py-1.5 text-xs font-medium text-white"
                : "rounded-full border border-night-200 px-3.5 py-1.5 text-xs font-medium text-night-600 hover:bg-night-50"
            }
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      {courses.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-5 w-5" />}
          title="Aucune formation dans ce filtre"
          description="Changez de filtre pour voir les autres formations."
        />
      ) : (
        <div className="space-y-3">
          {courses.map((course) => (
            <article key={course.id} className="rounded-2xl border border-night-100 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-night-800">{course.title_fr}</h3>
                    <Badge
                      tone={
                        course.status === "published"
                          ? "green"
                          : course.status === "in_review"
                            ? "gold"
                            : course.status === "archived"
                              ? "red"
                              : "neutral"
                      }
                    >
                      {STATUS_LABELS[course.status]}
                    </Badge>
                    {course.source === "ai_generated" && <Badge tone="electric">IA</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-night-400">
                    {course.school?.name_fr ?? "—"} · {course.instructor?.full_name ?? "Formateur"} ·{" "}
                    {course.is_free ? "Gratuit" : formatXof(course.price_xof)} · modifiée le{" "}
                    {formatDate(course.updated_at)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/formateur/formations/${course.id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-night-200 px-3 py-1.5 text-xs font-medium text-night-600 hover:bg-night-50"
                  >
                    Contenu
                  </Link>
                  {course.status === "published" && (
                    <Link
                      href={`/formations/${course.slug}`}
                      className="inline-flex items-center gap-1 rounded-full border border-night-200 px-3 py-1.5 text-xs font-medium text-night-600 hover:bg-night-50"
                    >
                      <ExternalLink className="h-3 w-3" aria-hidden />
                      Page publique
                    </Link>
                  )}
                </div>
              </div>

              <div className="mt-3 border-t border-night-100 pt-3">
                <CourseReviewActions courseId={course.id} status={course.status} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
