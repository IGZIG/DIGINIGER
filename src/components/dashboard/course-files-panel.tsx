import { Download, FileText, FileSpreadsheet, Presentation, Image as ImageIcon, FileType2 } from "lucide-react";
import { formatBytes, familyOf } from "@/lib/course-files";
import { formatDate } from "@/lib/utils";

const ICONS = {
  pdf: FileText,
  word: FileText,
  presentation: Presentation,
  sheet: FileSpreadsheet,
  text: FileType2,
  image: ImageIcon,
  other: FileText,
};

/**
 * Supports d'une formation, vus par l'apprenant inscrit.
 * Le téléchargement passe par /api/documents/[id]/telecharger, qui revérifie
 * l'inscription et délivre un lien signé de 5 minutes.
 */
export function CourseFilesPanel({
  files,
}: {
  files: Array<{
    id: string;
    title: string;
    description: string | null;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
  }>;
}) {
  if (files.length === 0) return null;

  return (
    <section className="rounded-2xl border border-night-100 bg-white p-4">
      <div className="flex items-center gap-2">
        <Download className="h-4 w-4 text-electric-600" aria-hidden />
        <h3 className="text-sm font-semibold text-night-800">
          Supports de la formation ({files.length})
        </h3>
      </div>
      <p className="mt-0.5 text-xs text-night-400">
        Documents mis à disposition par votre formateur.
      </p>

      <ul className="mt-3 divide-y divide-night-100">
        {files.map((file) => {
          const family = familyOf(file.mime_type);
          const Icon = ICONS[family] ?? FileText;
          return (
            <li key={file.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-mist">
                <Icon className="h-4 w-4 text-night-600" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-night-800">{file.title}</p>
                <p className="truncate text-xs text-night-400">
                  {formatBytes(Number(file.size_bytes))} · ajouté le {formatDate(file.created_at)}
                </p>
                {file.description && (
                  <p className="mt-0.5 text-xs text-night-500">{file.description}</p>
                )}
              </div>
              <a
                href={`/api/documents/${file.id}/telecharger`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-electric-200 bg-white px-3 py-1.5 text-xs font-medium text-electric-700 hover:bg-electric-50"
              >
                <Download className="h-3 w-3" aria-hidden />
                Télécharger
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
