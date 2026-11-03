import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CourseEditor } from "@/components/dashboard/course-editor";
import { requireRole } from "@/lib/auth";
import { getCourseForEdit, listSchools } from "@/lib/queries";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Lesson } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRole(["instructor"], `/formateur/formations/${id}`);

  const { course, modules, exercises } = await getCourseForEdit(id);
  if (!course) notFound();

  // Un formateur ne peut éditer que ses propres formations (l'admin, toutes).
  if (course.instructor_id !== user.authId && user.profile?.role !== "admin") {
    notFound();
  }

  const supabase = await createServerSupabase();
  const { data: lessons } = modules.length
    ? await supabase
        .from("lessons")
        .select("*")
        .in("module_id", modules.map((module) => module.id))
        .order("position")
    : { data: [] };

  const schools = await listSchools();

  return (
    <div className="space-y-5">
      <Link
        href="/formateur/formations"
        className="inline-flex items-center gap-1 text-xs font-medium text-night-400 hover:text-night-700"
      >
        <ChevronLeft className="h-3 w-3" aria-hidden />
        Mes formations
      </Link>

      <CourseEditor
        course={course}
        modules={modules}
        lessons={(lessons ?? []) as Lesson[]}
        exercises={exercises}
        schools={schools.map((school) => ({ id: school.id, name: school.name_fr }))}
      />
    </div>
  );
}
