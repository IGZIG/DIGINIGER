"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  FileSpreadsheet,
  Presentation,
  Image as ImageIcon,
  Trash2,
  Pencil,
  Eye,
  EyeOff,
  Download,
  X,
  CheckCircle2,
  FileType2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import {
  deleteCourseFileAction,
  prepareCourseFileUploadsAction,
  registerCourseFilesAction,
  updateCourseFileAction,
} from "@/lib/actions/course-files";
import {
  ACCEPT_ATTRIBUTE,
  MAX_FILES_PER_BATCH,
  familyOf,
  formatBytes,
  mimeFromExtension,
  preflightError,
} from "@/lib/course-files";
import { formatDate } from "@/lib/utils";

export interface CourseFileRow {
  id: string;
  title: string;
  description: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  visibility: string;
  downloadCount: number;
  createdAt: string;
}

const FAMILY_ICON = {
  pdf: FileText,
  word: FileText,
  presentation: Presentation,
  sheet: FileSpreadsheet,
  text: FileType2,
  image: ImageIcon,
  other: FileText,
};

const FAMILY_TONE: Record<string, "electric" | "gold" | "green" | "neutral" | "red"> = {
  pdf: "red",
  word: "electric",
  presentation: "gold",
  sheet: "green",
  text: "neutral",
  image: "neutral",
  other: "neutral",
};

/**
 * Gestion des documents d'une formation.
 * Import multiple (glisser-déposer ou sélection), publication/masquage,
 * renommage, suppression et téléchargement.
 *
 * Les contrôles affichés ici (format, taille) sont un confort : le serveur
 * refait tous les contrôles et reste la seule autorité.
 */
export function FileManager({
  courseId,
  files,
  compact = false,
}: {
  courseId: string;
  files: CourseFileRow[];
  compact?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const [selected, setSelected] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"visible" | "hidden">("visible");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refused, setRefused] = useState<Array<{ name: string; reason: string }>>([]);
  const [editing, setEditing] = useState<CourseFileRow | null>(null);

  const addFiles = (incoming: FileList | File[]) => {
    setError(null);
    setNotice(null);
    setRefused([]);
    const list = Array.from(incoming);

    const problems: Array<{ name: string; reason: string }> = [];
    const accepted: File[] = [];

    for (const file of list) {
      const reason = preflightError(file);
      if (reason) problems.push({ name: file.name, reason });
      else accepted.push(file);
    }

    const merged = [...selected, ...accepted].slice(0, MAX_FILES_PER_BATCH);
    if (selected.length + accepted.length > MAX_FILES_PER_BATCH) {
      problems.push({
        name: "Sélection",
        reason: `${MAX_FILES_PER_BATCH} fichiers au maximum par envoi.`,
      });
    }

    setSelected(merged);
    if (problems.length) setRefused(problems);
  };

  /**
   * Import en trois temps (le fichier ne transite pas par le serveur de
   * l'application, ce qui autorise des documents jusqu'à 25 Mo) :
   *   1. demande de tickets de dépôt ;
   *   2. envoi direct depuis le navigateur vers le stockage ;
   *   3. enregistrement des fiches.
   */
  const submit = () => {
    setError(null);
    setNotice(null);
    if (selected.length === 0) {
      setError("Choisissez au moins un fichier.");
      return;
    }

    startTransition(async () => {
      // --- 1. Tickets de dépôt ------------------------------------------
      const request = new FormData();
      request.set("courseId", courseId);
      request.set(
        "files",
        JSON.stringify(selected.map((file) => ({ name: file.name, size: file.size }))),
      );

      const prepared = await prepareCourseFileUploadsAction(request);
      if (!prepared.ok) {
        setError(humanError(prepared.code, prepared.message));
        return;
      }

      const { tickets } = prepared.data;
      const refusedNames = [...prepared.data.refused];

      // --- 2. Dépôt direct dans le stockage privé -----------------------
      const storage = createClient();
      const deposited: Array<{ name: string; size: number; path: string }> = [];

      for (const file of selected) {
        const ticket = tickets.find((entry) => entry.name === file.name);
        if (!ticket) continue;

        const upload = await storage.storage
          .from("course-files")
          .uploadToSignedUrl(ticket.path, ticket.token, file, {
            contentType: mimeFromExtension(file.name) ?? "application/octet-stream",
            upsert: false,
          });

        if (upload.error) {
          refusedNames.push({
            name: file.name,
            reason: `Envoi interrompu : ${upload.error.message}`,
          });
          continue;
        }

        deposited.push({ name: file.name, size: file.size, path: ticket.path });
      }

      if (deposited.length === 0) {
        setRefused(refusedNames);
        setError(
          refusedNames[0]?.reason ??
            "L'envoi a échoué. Vérifiez votre connexion puis réessayez.",
        );
        return;
      }

      // --- 3. Enregistrement des fiches ---------------------------------
      const registration = new FormData();
      registration.set("courseId", courseId);
      registration.set("title", title);
      registration.set("description", description);
      registration.set("visibility", visibility);
      registration.set("files", JSON.stringify(deposited));
      for (const entry of deposited) {
        registration.set(`path::${entry.name}`, entry.path);
      }

      const result = await registerCourseFilesAction(registration);
      if (!result.ok) {
        setError(humanError(result.code, result.message));
        return;
      }

      setRefused([...refusedNames, ...result.data.refused]);
      setNotice(
        result.data.imported.length === 1
          ? "1 document importé et disponible immédiatement."
          : `${result.data.imported.length} documents importés et disponibles immédiatement.`,
      );
      setSelected([]);
      setTitle("");
      setDescription("");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    });
  };

  const remove = (file: CourseFileRow) => {
    if (!window.confirm(`Supprimer définitivement « ${file.title} » ?`)) return;
    startTransition(async () => {
      const result = await deleteCourseFileAction(file.id);
      if (!result.ok) setError(humanError(result.code, result.message));
      else {
        setNotice("Document supprimé.");
        router.refresh();
      }
    });
  };

  const toggleVisibility = (file: CourseFileRow) => {
    const formData = new FormData();
    formData.set("id", file.id);
    formData.set("title", file.title);
    formData.set("description", file.description ?? "");
    formData.set("visibility", file.visibility === "visible" ? "hidden" : "visible");
    startTransition(async () => {
      const result = await updateCourseFileAction(formData);
      if (!result.ok) setError(humanError(result.code, result.message));
      else router.refresh();
    });
  };

  const saveEdit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateCourseFileAction(formData);
      if (!result.ok) {
        setError(humanError(result.code, result.message));
        return;
      }
      setEditing(null);
      setNotice("Document mis à jour.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {/* --- Zone d'import ------------------------------------------------ */}
      <section className="rounded-2xl border border-night-100 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-night-800">Importer des documents</h3>
            <p className="mt-0.5 text-xs text-night-400">
              PDF, Word, PowerPoint, tableur, texte ou image — 25 Mo par fichier,{" "}
              {MAX_FILES_PER_BATCH} fichiers maximum par envoi.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={pending}
          >
            <Upload className="h-4 w-4" aria-hidden />
            Choisir des fichiers
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          className="sr-only"
          aria-label="Fichiers à importer"
          onChange={(event) => event.target.files && addFiles(event.target.files)}
        />

        {/* Glisser-déposer */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
          }}
          className={`mt-3 cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
            dragging
              ? "border-electric-400 bg-electric-50"
              : "border-night-200 bg-mist/60 hover:border-electric-300 hover:bg-electric-50/40"
          }`}
        >
          <Upload className="mx-auto h-5 w-5 text-night-400" aria-hidden />
          <p className="mt-2 text-sm font-medium text-night-700">
            Déposez vos fichiers ici, ou cliquez pour parcourir
          </p>
          <p className="mt-0.5 text-xs text-night-400">
            Plusieurs fichiers à la fois sont acceptés.
          </p>
        </div>

        {selected.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {selected.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center justify-between gap-2 rounded-xl border border-night-100 bg-mist/40 px-3 py-2 text-xs"
              >
                <span className="truncate font-medium text-night-700">{file.name}</span>
                <span className="flex items-center gap-2 text-night-400">
                  {formatBytes(file.size)}
                  <button
                    type="button"
                    aria-label={`Retirer ${file.name}`}
                    onClick={() => setSelected(selected.filter((_, i) => i !== index))}
                    className="rounded-full p-1 hover:bg-white"
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Champs facultatifs */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-night-600">
            Titre <span className="font-normal text-night-400">(facultatif)</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={160}
              placeholder="Ex. : Support du module 1"
              className="mt-1 w-full rounded-xl border border-night-200 px-3 py-2 text-sm font-normal text-night-800 focus:border-electric-400 focus:outline-none"
            />
          </label>
          <label className="text-xs font-medium text-night-600">
            Visibilité
            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as "visible" | "hidden")}
              className="mt-1 w-full rounded-xl border border-night-200 bg-white px-3 py-2 text-sm font-normal text-night-800 focus:border-electric-400 focus:outline-none"
            >
              <option value="visible">Visible par les apprenants inscrits</option>
              <option value="hidden">Masqué (formateur et administration uniquement)</option>
            </select>
          </label>
        </div>
        <label className="mt-3 block text-xs font-medium text-night-600">
          Description <span className="font-normal text-night-400">(facultatif)</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="À quoi sert ce document ?"
            className="mt-1 w-full rounded-xl border border-night-200 px-3 py-2 text-sm font-normal text-night-800 focus:border-electric-400 focus:outline-none"
          />
        </label>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={submit}
            loading={pending}
            disabled={selected.length === 0 || pending}
          >
            <Upload className="h-4 w-4" aria-hidden />
            Importer {selected.length > 0 ? `(${selected.length})` : ""}
          </Button>
          {selected.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setSelected([])}
              disabled={pending}
            >
              Annuler
            </Button>
          )}
        </div>

        {error && (
          <div className="mt-3">
            <Alert tone="error">{error}</Alert>
          </div>
        )}
        {notice && (
          <div className="mt-3">
            <Alert tone="success">{notice}</Alert>
          </div>
        )}
        {refused.length > 0 && (
          <div className="mt-3">
            <Alert tone="warning" title="Fichiers non importés">
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {refused.map((item) => (
                  <li key={item.name}>
                    <span className="font-medium">{item.name}</span> — {item.reason}
                  </li>
                ))}
              </ul>
            </Alert>
          </div>
        )}
      </section>

      {/* --- Liste des documents ----------------------------------------- */}
      <section className="overflow-hidden rounded-2xl border border-night-100 bg-white">
        <div className="flex items-center justify-between gap-2 border-b border-night-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-night-800">
            Documents de la formation ({files.length})
          </h3>
          {files.length > 0 && (
            <span className="text-xs text-night-400">
              Les apprenants inscrits voient les documents marqués « visible ».
            </span>
          )}
        </div>

        {files.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-night-400">
            Aucun document pour l'instant. Importez votre premier support ci-dessus.
          </p>
        ) : (
          <ul className="divide-y divide-night-100">
            {files.map((file) => {
              const family = familyOf(file.mimeType);
              const Icon = FAMILY_ICON[family] ?? FileText;
              return (
                <li key={file.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mist">
                    <Icon className="h-4 w-4 text-night-600" aria-hidden />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-night-800">{file.title}</p>
                    <p className="truncate text-xs text-night-400">
                      {file.fileName} · {formatBytes(file.sizeBytes)} ·{" "}
                      {file.downloadCount} téléchargement{file.downloadCount > 1 ? "s" : ""} ·{" "}
                      {formatDate(file.createdAt)}
                    </p>
                    {!compact && file.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-night-500">
                        {file.description}
                      </p>
                    )}
                  </div>

                  <Badge tone={FAMILY_TONE[family] ?? "neutral"}>
                    {file.visibility === "visible" ? "visible" : "masqué"}
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
                    <button
                      type="button"
                      onClick={() => toggleVisibility(file)}
                      className="rounded-full p-2 text-night-500 hover:bg-mist hover:text-night-800"
                      aria-label={file.visibility === "visible" ? "Masquer" : "Rendre visible"}
                      title={file.visibility === "visible" ? "Masquer aux apprenants" : "Rendre visible"}
                      disabled={pending}
                    >
                      {file.visibility === "visible" ? (
                        <EyeOff className="h-4 w-4" aria-hidden />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(file)}
                      className="rounded-full p-2 text-night-500 hover:bg-mist hover:text-night-800"
                      aria-label={`Renommer ${file.title}`}
                      title="Renommer / modifier"
                      disabled={pending}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(file)}
                      className="rounded-full p-2 text-red-500 hover:bg-red-50"
                      aria-label={`Supprimer ${file.title}`}
                      title="Supprimer"
                      disabled={pending}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* --- Modale de modification -------------------------------------- */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-night-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Modifier le document"
        >
          <form
            onSubmit={saveEdit}
            className="w-full max-w-lg space-y-3 rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Modifier le document</h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Fermer"
                className="rounded-full p-1.5 text-night-400 hover:bg-mist"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <input type="hidden" name="id" value={editing.id} />
            <label className="block text-xs font-medium text-night-600">
              Titre
              <input
                name="title"
                defaultValue={editing.title}
                required
                minLength={3}
                maxLength={160}
                className="mt-1 w-full rounded-xl border border-night-200 px-3 py-2 text-sm font-normal text-night-800 focus:border-electric-400 focus:outline-none"
              />
            </label>
            <label className="block text-xs font-medium text-night-600">
              Description
              <textarea
                name="description"
                defaultValue={editing.description ?? ""}
                rows={3}
                maxLength={2000}
                className="mt-1 w-full rounded-xl border border-night-200 px-3 py-2 text-sm font-normal text-night-800 focus:border-electric-400 focus:outline-none"
              />
            </label>
            <label className="block text-xs font-medium text-night-600">
              Visibilité
              <select
                name="visibility"
                defaultValue={editing.visibility}
                className="mt-1 w-full rounded-xl border border-night-200 bg-white px-3 py-2 text-sm font-normal text-night-800 focus:border-electric-400 focus:outline-none"
              >
                <option value="visible">Visible par les apprenants inscrits</option>
                <option value="hidden">Masqué</option>
              </select>
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>
                Annuler
              </Button>
              <Button type="submit" size="sm" loading={pending}>
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Enregistrer
              </Button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}

function humanError(code: string, fallback?: string): string {
  const messages: Record<string, string> = {
    AUTH_REQUIRED: "Votre session a expiré : reconnectez-vous.",
    FORBIDDEN: "Vous n'avez pas le droit de modifier les documents de cette formation.",
    COURSE_NOT_FOUND: "Formation introuvable, ou vous n'en êtes pas le formateur.",
    FILE_NOT_FOUND: "Ce document n'existe plus.",
    NO_FILE: "Choisissez au moins un fichier.",
    TOO_MANY_FILES: `Pas plus de ${MAX_FILES_PER_BATCH} fichiers à la fois.`,
    TITLE_TOO_SHORT: "Le titre doit faire au moins 3 caractères.",
    UPLOAD_FAILED: "L'import a échoué. Réessayez.",
  };
  return messages[code] ?? fallback ?? "Une erreur est survenue. Réessayez.";
}
