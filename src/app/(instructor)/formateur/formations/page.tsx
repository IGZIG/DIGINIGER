import type { Metadata } from "next";
import Link from "next/link";
import { Plus, BookOpen, ArrowRight } from "lucide-react";
import { EmptyState } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/auth";
import { listCoursesForStaff } from "@/lib/queries";
import { STATUS_LABELS, formatDate, formatXof } from "@/lib/utils";

export const metadata = { title: "Mes formations (formateur)" };
export const dynamic = "force-dynamic";

export default async function InstructorCoursesPage() {
  const user = await requireRole(["instructor"], "/formateur/formations");
  const courses = await listCoursesForStaff(user.authId, user.profile?.role === "admin");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Mes formations ({courses.length})</h2>
          <p className="text-sm text-night-400">
            Un brouillon doit être soumis à validation avant publication.
          </p>
        </div>
        <ButtonLink href="/formateur/generateur" size="sm">
          <Plus className="h-4 w-4" aria-hidden />
          Nouvelle formation
        </ButtonLink>
      </div>

      {courses.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-5 w-5" />}
          title="Aucune formation"
          description="Commencez par créer une formation : titre, école, niveau, prix, puis ajoutez vos modules et leçons."
          action={<ButtonLink href="/formateur/generateur">Créer ma première formation</ButtonLink>}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-night-100 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-mist text-left text-xs uppercase tracking-wider text-night-400">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Formation</th>
                <th scope="col" className="px-4 py-3 font-medium">École</th>
                <th scope="col" className="px-4 py-3 font-medium">Prix</th>
                <th scope="col" className="px-4 py-3 font-medium">Statut</th>
                <th scope="col" className="px-4 py-3 font-medium">Modifiée</th>
                <th scope="col" className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-night-100">
              {courses.map((course) => {
                const typed = course as unknown as {
                  id: string;
                  title_fr: string;
                  status: keyof typeof STATUS_LABELS;
                  price_xof: number;
                  is_free: boolean;
                  updated_at: string;
                  school?: { name_fr?: string } | null;
                };
                return (
                  <tr key={typed.id} className="hover:bg-mist/40">
                    <td className="px-4 py-3 font-medium text-night-800">{typed.title_fr}</td>
                    <td className="px-4 py-3 text-night-500">{typed.school?.name_fr ?? "—"}</td>
                    <td className="px-4 py-3 text-night-500">
                      {typed.is_free ? "Gratuit" : formatXof(typed.price_xof)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          typed.status === "published"
                            ? "green"
                            : typed.status === "in_review"
                              ? "gold"
                              : typed.status === "archived"
                                ? "red"
                                : "neutral"
                        }
                      >
                        {STATUS_LABELS[typed.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-night-400">{formatDate(typed.updated_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/formateur/formations/${typed.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-electric-600 hover:underline"
                      >
                        Éditer
                        <ArrowRight className="h-3 w-3" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
