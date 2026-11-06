import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen, Upload } from "lucide-react";
import { EmptyState } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { listCourseFilesForStaff, listCoursesForStaff } from "@/lib/queries";
import { ACCEPTED_EXTENSIONS } from "@/lib/course-files";
import { DocumentsLibrary } from "@/components/dashboard/documents-library";

export const metadata: Metadata = { title: "Mes documents (formateur)" };
export const dynamic = "force-dynamic";

/**
 * Bibliothèque de documents du formateur.
 * Tous ses supports, toutes formations confondues, avec recherche et filtre.
 * L'import lui-même se fait dans la formation concernée (le document doit
 * être rattaché à une formation pour que les apprenants le voient).
 */
export default async function InstructorDocumentsPage() {
  const user = await requireRole(["instructor"], "/formateur/documents");
  const isAdmin = user.profile?.role === "admin";

  const [courses, files] = await Promise.all([
    listCoursesForStaff(user.authId, isAdmin),
    listCourseFilesForStaff(user.authId, isAdmin),
  ]);

  const courseOptions = courses.map((course) => {
    const typed = course as unknown as { id: string; title_fr: string };
    return { id: typed.id, title: typed.title_fr };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            Mes documents ({files.length})
          </h2>
          <p className="text-sm text-night-400">
            Vos supports pédagogiques, toutes formations confondues.
          </p>
        </div>
        <ButtonLink href="/formateur/formations" size="sm" variant="outline">
          <FolderOpen className="h-4 w-4" aria-hidden />
          Aller à mes formations
        </ButtonLink>
      </div>

      {courseOptions.length === 0 ? (
        <EmptyState
          icon={<Upload className="h-5 w-5" />}
          title="Aucune formation"
          description="Un document se rattache toujours à une formation. Créez d'abord une formation, puis importez-y vos supports."
          action={<ButtonLink href="/formateur/generateur">Créer une formation</ButtonLink>}
        />
      ) : (
        <DocumentsLibrary
          files={files.map((file) => ({
            id: file.id,
            title: file.title,
            description: file.description,
            fileName: file.file_name,
            mimeType: file.mime_type,
            sizeBytes: Number(file.size_bytes),
            visibility: file.visibility,
            downloadCount: file.download_count,
            createdAt: file.created_at,
            courseId: file.course_id,
            courseTitle: file.course_title,
          }))}
          courses={courseOptions}
        />
      )}

      <p className="text-xs text-night-400">
        Formats acceptés : {ACCEPTED_EXTENSIONS.join(", ")} — 25 Mo maximum par fichier.
      </p>
    </div>
  );
}
