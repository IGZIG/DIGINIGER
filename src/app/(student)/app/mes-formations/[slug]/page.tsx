import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Award, ClipboardCheck } from "lucide-react";
import { LessonPlayer } from "@/components/dashboard/lesson-player";
import { CertificateRequestButton } from "@/components/dashboard/certificate-request";
import { getCourseCurriculum, getMyEnrollment, getMyProgress, getPublicCourseBySlug } from "@/lib/queries";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import type { Exercise } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function LearnPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser(`/app/mes-formations/${slug}`);

  const course = await getPublicCourseBySlug(slug);
  if (!course) notFound();

  const enrollment = await getMyEnrollment(user.authId, course.id);
  if (!enrollment) {
    // Non inscrit : on renvoie vers la fiche publique, pas d'accès au contenu.
    redirect(`/formations/${slug}`);
  }

  const [curriculum, progress] = await Promise.all([
    getCourseCurriculum(course.id),
    getMyProgress(user.authId, course.id),
  ]);

  const supabase = await createServerSupabase();
  const { data: exercises } = await supabase
    .from("exercises")
    .select("*")
    .eq("course_id", course.id)
    .eq("is_published", true)
    .order("is_exam", { ascending: false });

  const exams = (exercises ?? []) as Exercise[];
  const allLessonsDone = curriculum.lessons.length > 0 && progress.filter((p) => p.status === "completed").length >= curriculum.lessons.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/app/mes-formations"
            className="inline-flex items-center gap-1 text-xs font-medium text-night-400 hover:text-night-700"
          >
            <ChevronLeft className="h-3 w-3" aria-hidden />
            Mes formations
          </Link>
          <h2 className="mt-1.5 text-xl font-semibold">{course.title_fr}</h2>
          <p className="text-sm text-night-400">{course.school_name_fr}</p>
        </div>

        {allLessonsDone && (
          <CertificateRequestButton courseId={course.id} alreadyIssued={false} />
        )}
      </div>

      {exams.length > 0 && (
        <section className="rounded-2xl border border-electric-100 bg-electric-50/50 p-4">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-electric-600" aria-hidden />
            <p className="text-sm font-semibold text-night-800">Évaluations de cette formation</p>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {exams.map((exam) => (
              <li key={exam.id}>
                <Link
                  href={`/app/evaluations/${exam.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-electric-200 bg-white px-3.5 py-1.5 text-xs font-medium text-electric-700 hover:bg-electric-50"
                >
                  {exam.is_exam && <Award className="h-3 w-3" aria-hidden />}
                  {exam.title_fr}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <LessonPlayer
        courseId={course.id}
        courseSlug={course.slug}
        modules={curriculum.modules}
        lessons={curriculum.lessons}
        progress={progress}
      />
    </div>
  );
}
