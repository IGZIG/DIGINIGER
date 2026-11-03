import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { listSchools } from "@/lib/queries";
import { CourseBuilder } from "@/components/dashboard/course-builder";
import { isAiConfigured } from "@/lib/ai/tutor";

export const metadata = { title: "Créer une formation" };
export const dynamic = "force-dynamic";

export default async function GeneratorPage() {
  await requireRole(["instructor"], "/formateur/generateur");
  const schools = await listSchools();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Créer une formation</h2>
        <p className="text-sm text-night-400">
          Deux méthodes : construire manuellement votre parcours, ou générer un brouillon complet
          avec l&apos;assistant IA puis l&apos;ajuster avant publication.
        </p>
      </div>

      <CourseBuilder
        schools={schools.map((school) => ({ id: school.id, name: school.name_fr }))}
        aiConfigured={isAiConfigured()}
      />
    </div>
  );
}
