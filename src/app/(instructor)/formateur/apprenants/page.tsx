import type { Metadata } from "next";
import { Users } from "lucide-react";
import { Avatar, EmptyState, Progress } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Apprenants (formateur)" };
export const dynamic = "force-dynamic";

interface EnrollmentRow {
  id: string;
  course_id: string;
  progress_pct: number;
  enrolled_at: string;
  profile?: { full_name?: string; email?: string } | null;
}

export default async function InstructorStudentsPage() {
  const user = await requireRole(["instructor"], "/formateur/apprenants");
  const supabase = await createServerSupabase();

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title_fr")
    .eq("instructor_id", user.authId);

  const courseIds = (courses ?? []).map((course) => course.id);

  const { data: enrollments } = courseIds.length
    ? await supabase
        .from("enrollments")
        .select("id, course_id, progress_pct, enrolled_at, profile:profiles!enrollments_user_id_fkey(full_name, email)")
        .in("course_id", courseIds)
        .order("enrolled_at", { ascending: false })
        .limit(200)
    : { data: [] as EnrollmentRow[] };

  const courseTitles = new Map((courses ?? []).map((course) => [course.id, course.title_fr]));
  const rows = (enrollments ?? []) as unknown as EnrollmentRow[];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Mes apprenants ({rows.length})</h2>
        <p className="text-sm text-night-400">
          Suivi des inscriptions et de la progression sur vos formations.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="Aucun apprenant pour le moment"
          description="Les inscriptions apparaîtront ici dès la publication de vos formations."
          action={<ButtonLink href="/formateur/formations" variant="outline">Mes formations</ButtonLink>}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-night-100 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-mist text-left text-xs uppercase tracking-wider text-night-400">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Apprenant</th>
                <th scope="col" className="px-4 py-3 font-medium">Formation</th>
                <th scope="col" className="px-4 py-3 font-medium">Inscrit le</th>
                <th scope="col" className="px-4 py-3 font-medium">Progression</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-night-100">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <Avatar name={row.profile?.full_name ?? "Apprenant"} size={28} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-night-800">
                          {row.profile?.full_name || "Apprenant"}
                        </span>
                        <span className="block truncate text-xs text-night-400">{row.profile?.email}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-night-500">{courseTitles.get(row.course_id) ?? "—"}</td>
                  <td className="px-4 py-3 text-night-400">{formatDate(row.enrolled_at)}</td>
                  <td className="px-4 py-3">
                    <Progress
                      value={row.progress_pct}
                      className="w-32"
                      tone={row.progress_pct === 100 ? "green" : "electric"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
