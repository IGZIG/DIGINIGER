"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Download, FileText, Eye, EyeOff, ExternalLink } from "lucide-react";
import { EmptyState } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import type { CourseFileRow } from "@/components/dashboard/file-manager";
import { familyOf, formatBytes } from "@/lib/course-files";
import { formatDate } from "@/lib/utils";

export interface LibraryRow extends CourseFileRow {
  courseId: string;
  courseTitle: string;
}

/**
 * Bibliothèque de documents (lecture seule).
 * La modification et la suppression se font depuis la formation concernée :
 * c'est le seul endroit où le document a un contexte pédagogique.
 */
export function DocumentsLibrary({
  files,
  courses,
}: {
  files: LibraryRow[];
  courses: Array<{ id: string; title: string }>;
}) {
  const [query, setQuery] = useState("");
  const [course, setCourse] = useState("tous");
  const [visibility, setVisibility] = useState("tous");

  const filtered = useMemo(() => {
    return files.filter((file) => {
      const matchesQuery =
        query.trim() === "" ||
        `${file.title} ${file.fileName} ${file.courseTitle} ${file.description ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase());
      const matchesCourse = course === "tous" || file.courseId === course;
      const matchesVisibility = visibility === "tous" || file.visibility === visibility;
      return matchesQuery && matchesCourse && matchesVisibility;
    });
  }, [files, query, course, visibility]);

  if (files.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-5 w-5" />}
        title="Aucun document importé"
        description="Ouvrez une de vos formations, puis utilisez la section « Documents de la formation » pour importer vos supports."
        action={
          <Link
            href="/formateur/formations"
            className="inline-flex items-center gap-1.5 rounded-full bg-electric-500 px-4 py-2 text-sm font-medium text-white hover:bg-electric-600"
          >
            Choisir une formation
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-night-100 bg-white p-3">
        <label className="relative flex-1 min-w-[220px]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-night-400"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un document…"
            aria-label="Rechercher un document"
            className="w-full rounded-xl border border-night-200 py-2 pl-9 pr-3 text-sm focus:border-electric-400 focus:outline-none"
          />
        </label>
        <select
          value={course}
          onChange={(event) => setCourse(event.target.value)}
          aria-label="Filtrer par formation"
          className="rounded-xl border border-night-200 bg-white px-3 py-2 text-sm focus:border-electric-400 focus:outline-none"
        >
          <option value="tous">Toutes les formations</option>
          {courses.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
        <select
          value={visibility}
          onChange={(event) => setVisibility(event.target.value)}
          aria-label="Filtrer par visibilité"
          className="rounded-xl border border-night-200 bg-white px-3 py-2 text-sm focus:border-electric-400 focus:outline-none"
        >
          <option value="tous">Visible et masqué</option>
          <option value="visible">Visible</option>
          <option value="hidden">Masqué</option>
        </select>
        <span className="text-xs text-night-400">
          {filtered.length} / {files.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-night-100 bg-white px-4 py-8 text-center text-sm text-night-400">
          Aucun document ne correspond à cette recherche.
        </p>
      ) : (
        <ul className="divide-y divide-night-100 overflow-hidden rounded-2xl border border-night-100 bg-white">
          {filtered.map((file) => {
            const family = familyOf(file.mimeType);
            return (
              <li key={file.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mist">
                  <FileText className="h-4 w-4 text-night-600" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-night-800">{file.title}</p>
                  <p className="truncate text-xs text-night-400">
                    {file.courseTitle} · {file.fileName} · {formatBytes(file.sizeBytes)} ·{" "}
                    {file.downloadCount} téléchargement{file.downloadCount > 1 ? "s" : ""} ·{" "}
                    {formatDate(file.createdAt)}
                  </p>
                </div>
                <Badge tone={family === "pdf" ? "red" : family === "sheet" ? "green" : "neutral"}>
                  {family === "other" ? "fichier" : family}
                </Badge>
                <Badge tone={file.visibility === "visible" ? "electric" : "neutral"}>
                  {file.visibility === "visible" ? (
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3 w-3" aria-hidden /> visible
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <EyeOff className="h-3 w-3" aria-hidden /> masqué
                    </span>
                  )}
                </Badge>
                <div className="flex items-center gap-1">
                  <a
                    href={`/api/documents/${file.id}/telecharger`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full p-2 text-night-500 hover:bg-mist hover:text-night-800"
                    aria-label={`Télécharger ${file.title}`}
                    title="Télécharger"
                  >
                    <Download className="h-4 w-4" aria-hidden />
                  </a>
                  <Link
                    href={`/formateur/formations/${file.courseId}`}
                    className="rounded-full p-2 text-night-500 hover:bg-mist hover:text-night-800"
                    aria-label={`Gérer dans ${file.courseTitle}`}
                    title="Gérer dans la formation"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
