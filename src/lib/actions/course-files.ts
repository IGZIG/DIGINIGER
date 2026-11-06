"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/actions/audit";
import {
  MAX_FILES_PER_BATCH,
  extensionOf,
  looksLikeType,
  mimeFromExtension,
  preflightError,
  safeFileName,
} from "@/lib/course-files";
import type { ActionResult } from "@/lib/actions/learning";

/** Échec homogène : un code + un message affichable tel quel. */
function fail(code: string, message?: string): ActionResult<never> {
  return { ok: false, code, message: message ?? code };
}

/**
 * Documents de formation — Server Actions.
 * ---------------------------------------------------------------------------
 * Règles appliquées ICI, côté serveur (jamais dans le navigateur seulement) :
 *
 *  1. La personne doit être connectée et avoir le rôle `instructor` ou
 *     `admin`, relu en base. Le rôle annoncé par le client n'est jamais cru.
 *  2. Un formateur n'agit que sur SES formations (`courses.instructor_id`).
 *     L'administrateur agit sur toutes.
 *  3. Le fichier est vérifié trois fois : extension autorisée, type MIME
 *     cohérent avec l'extension, et contenu réel (nombre magique) pour les
 *     formats qui en ont un. Un `.exe` renommé en `.pdf` est refusé.
 *  4. Le dépôt se fait dans le compartiment PRIVÉ `course-files`, sous le
 *     dossier du cours. Aucun lien public n'est créé.
 *  5. Chaque geste est inscrit dans `audit_logs`.
 *  6. Suppression : le fichier est retiré du stockage ET la ligne de la base,
 *     pour ne pas laisser d'objets orphelins.
 */

const BUCKET = "course-files";

interface CourseRef {
  id: string;
  instructor_id: string | null;
  title_fr: string;
}

/** Garde commune : renvoie le cours si la personne a le droit d'y toucher. */
async function requireCourseAccess(
  courseId: string,
): Promise<{ error: string; user: null; course: null } | { error: null; user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>; course: CourseRef }> {
  const user = await getCurrentUser();
  if (!user) return { error: "AUTH_REQUIRED", user: null, course: null };

  const role = user.profile?.role;
  if (role !== "instructor" && role !== "admin") {
    return { error: "FORBIDDEN", user: null, course: null };
  }

  const supabase = await createServerSupabase();
  const { data: course } = await supabase
    .from("courses")
    .select("id, instructor_id, title_fr")
    .eq("id", courseId)
    .maybeSingle<CourseRef>();

  if (!course) return { error: "COURSE_NOT_FOUND", user: null, course: null };

  if (role !== "admin" && course.instructor_id !== user.authId) {
    // On ne révèle pas l'existence d'une formation d'un autre formateur.
    return { error: "COURSE_NOT_FOUND", user: null, course: null };
  }

  return { error: null, user, course };
}

// ---------------------------------------------------------------------------
// 1. Importer un ou plusieurs documents
//
// Le fichier ne traverse PAS le serveur de l'application : les fonctions
// hébergées plafonnent les requêtes à 4,5 Mo alors qu'un document peut peser
// 25 Mo. L'import se fait donc en trois temps :
//   1. le serveur vérifie les droits et délivre un ticket de dépôt ;
//   2. le navigateur dépose le fichier directement dans le stockage Supabase ;
//   3. le serveur relit le début du fichier, vérifie que le contenu correspond
//      bien à l'extension annoncée, puis enregistre la fiche en base.
// ---------------------------------------------------------------------------

/** Fichier tel qu'annoncé par le navigateur avant le dépôt. */
export interface PendingFile {
  name: string;
  size: number;
}

/** Ticket de dépôt : chemin imposé par le serveur + jeton à usage unique. */
export interface UploadTicket {
  name: string;
  path: string;
  token: string;
}

interface FileOutcome {
  name: string;
  reason: string;
}

/** Découpe la liste envoyée par le client, sans jamais lui faire confiance. */
function parseFiles(raw: string): PendingFile[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as unknown[])
      .map((item) => {
        const entry = (item ?? {}) as Record<string, unknown>;
        return {
          name: String(entry.name ?? "").slice(0, 255),
          size: Number(entry.size ?? 0) || 0,
        };
      })
      .filter((entry) => entry.name.length > 0);
  } catch {
    return [];
  }
}

/** Lit les premiers octets d'un objet déjà déposé, via un lien signé. */
async function inspectStoredFile(
  path: string,
): Promise<{ header: Uint8Array; size: number | null } | null> {
  const admin = createAdminClient();
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(path, 60);
  if (!data?.signedUrl) return null;

  // Requête partielle : seuls les 16 premiers octets sont téléchargés.
  const response = await fetch(data.signedUrl, {
    headers: { Range: "bytes=0-15" },
    cache: "no-store",
  });
  if (!response.ok && response.status !== 206) return null;
  if (!response.body) return null;

  const reader = response.body.getReader();
  const { value } = await reader.read();
  // On abandonne la lecture : le reste du fichier ne nous intéresse pas.
  await reader.cancel().catch(() => undefined);

  const range = response.headers.get("content-range");
  const declaredSize = range ? Number(range.split("/")[1] ?? NaN) : NaN;

  return {
    header: new Uint8Array(value ?? new ArrayBuffer(0)),
    size: Number.isFinite(declaredSize) ? declaredSize : null,
  };
}

/**
 * Étape 1 : vérifier la demande et délivrer les tickets de dépôt.
 * Aucun octet de fichier ne passe par ici.
 */
export async function prepareCourseFileUploadsAction(formData: FormData): Promise<
  ActionResult<{ tickets: UploadTicket[]; refused: FileOutcome[] }>
> {
  const courseId = String(formData.get("courseId") ?? "");
  if (!courseId) return fail("COURSE_REQUIRED");

  const access = await requireCourseAccess(courseId);
  if (access.error || !access.user) return fail(access.error ?? "FORBIDDEN");

  const incoming = parseFiles(String(formData.get("files") ?? "[]"));
  if (incoming.length === 0) return fail("NO_FILE");
  if (incoming.length > MAX_FILES_PER_BATCH) {
    return fail(
      "TOO_MANY_FILES",
      `Dix fichiers au maximum par envoi (vous en avez sélectionné ${incoming.length}).`,
    );
  }

  const admin = createAdminClient();
  const tickets: UploadTicket[] = [];
  const refused: FileOutcome[] = [];

  for (const file of incoming) {
    const preflight = preflightError({ name: file.name, size: file.size });
    if (preflight) {
      refused.push({ name: file.name, reason: preflight });
      continue;
    }

    const mime = mimeFromExtension(file.name);
    if (!mime) {
      refused.push({ name: file.name, reason: "Format non reconnu." });
      continue;
    }

    // Le chemin est décidé ici : le navigateur ne peut pas en choisir un autre,
    // et la politique du compartiment n'autorise que le dossier du cours.
    const path = `${courseId}/${Date.now()}-${crypto
      .randomUUID()
      .slice(0, 8)}-${safeFileName(file.name)}`;

    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data?.token) {
      refused.push({ name: file.name, reason: "Dépôt indisponible pour le moment." });
      continue;
    }

    tickets.push({ name: file.name, path, token: data.token });
  }

  if (tickets.length === 0) {
    return fail("NO_FILE", refused[0]?.reason ?? "Aucun fichier recevable.");
  }

  return { ok: true, data: { tickets, refused } };
}

/**
 * Étape 2 : enregistrer les fichiers réellement déposés.
 * Le serveur relit le contenu : un exécutable renommé en `.pdf` est supprimé
 * du stockage et refusé, même si le navigateur a réussi à le déposer.
 */
export async function registerCourseFilesAction(formData: FormData): Promise<
  ActionResult<{ imported: string[]; refused: FileOutcome[] }>
> {
  const courseId = String(formData.get("courseId") ?? "");
  if (!courseId) return fail("COURSE_REQUIRED");

  const access = await requireCourseAccess(courseId);
  if (access.error || !access.user || !access.course) return fail(access.error ?? "FORBIDDEN");

  const incoming = parseFiles(String(formData.get("files") ?? "[]"));
  if (incoming.length === 0) return fail("NO_FILE");
  if (incoming.length > MAX_FILES_PER_BATCH) return fail("TOO_MANY_FILES");

  const titleInput = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim().slice(0, 2000) || null;
  const visibility = formData.get("visibility") === "hidden" ? "hidden" : "visible";

  const admin = createAdminClient();
  const supabase = await createServerSupabase();
  const imported: string[] = [];
  const refused: FileOutcome[] = [];

  for (const file of incoming) {
    const preflight = preflightError({ name: file.name, size: file.size });
    if (preflight) {
      refused.push({ name: file.name, reason: preflight });
      continue;
    }

    const mime = mimeFromExtension(file.name);
    if (!mime) {
      refused.push({ name: file.name, reason: "Format non reconnu." });
      continue;
    }

    // Le dossier doit être exactement celui du cours : un formateur ne peut
    // pas faire enregistrer un objet déposé ailleurs.
    const path = String(formData.get(`path::${file.name}`) ?? "");
    if (!path.startsWith(`${courseId}/`) || path.includes("..")) {
      refused.push({ name: file.name, reason: "Emplacement de dépôt invalide." });
      continue;
    }

    const stored = await inspectStoredFile(path);
    if (!stored) {
      refused.push({ name: file.name, reason: "Le fichier n'a pas été reçu. Réessayez." });
      continue;
    }

    if (stored.size !== null && stored.size !== file.size) {
      refused.push({
        name: file.name,
        reason: "La taille du fichier reçu ne correspond pas à l'annonce. Import refusé.",
      });
      await admin.storage.from(BUCKET).remove([path]).catch(() => undefined);
      continue;
    }

    if (!looksLikeType(stored.header, mime)) {
      refused.push({
        name: file.name,
        reason: "Le contenu du fichier ne correspond pas à son extension. Import refusé par sécurité.",
      });
      await admin.storage.from(BUCKET).remove([path]).catch(() => undefined);
      continue;
    }

    const title = (
      incoming.length === 1 && titleInput
        ? titleInput
        : titleInput
          ? `${titleInput} — ${file.name}`
          : file.name
    ).slice(0, 160);

    const { data: inserted, error } = await supabase
      .from("course_files")
      .insert({
        course_id: courseId,
        uploaded_by: access.user.authId,
        title,
        description,
        storage_path: path,
        file_name: file.name,
        mime_type: mime,
        size_bytes: file.size,
        visibility,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      await admin.storage.from(BUCKET).remove([path]).catch(() => undefined);
      refused.push({
        name: file.name,
        reason: `Enregistrement impossible : ${error?.message ?? "inconnu"}`,
      });
      continue;
    }

    imported.push(title);

    await logAudit({
      actorId: access.user.authId,
      actorRole: access.user.profile?.role ?? "instructor",
      action: "course_file.upload",
      entity: "course_files",
      entityId: inserted.id as string,
      metadata: {
        course_id: courseId,
        file_name: file.name,
        mime_type: mime,
        size_bytes: file.size,
        visibility,
      },
      note: `Import du document « ${title} » dans « ${access.course.title_fr} »`,
    });
  }

  revalidatePath(`/formateur/formations/${courseId}`);
  revalidatePath("/formateur/documents");
  revalidatePath("/formateur/formations");

  if (imported.length === 0) {
    return fail("UPLOAD_FAILED", refused[0]?.reason ?? "L'import a échoué.");
  }

  return { ok: true, data: { imported, refused } };
}

// ---------------------------------------------------------------------------
// 2. Modifier un document (titre, description, visibilité)
// ---------------------------------------------------------------------------
export async function updateCourseFileAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const id = String(formData.get("id") ?? "");
  if (!id) return fail("FILE_REQUIRED");

  const user = await getCurrentUser();
  if (!user) return fail("AUTH_REQUIRED");
  const role = user.profile?.role;
  if (role !== "instructor" && role !== "admin") return fail("FORBIDDEN");

  const supabase = await createServerSupabase();
  // La RLS restreint déjà la lecture au propriétaire et à l'admin.
  const { data: existing } = await supabase
    .from("course_files")
    .select("id, course_id, title, visibility, description")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return fail("FILE_NOT_FOUND");

  const access = await requireCourseAccess(existing.course_id as string);
  if (access.error) return fail(access.error);

  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 3) return fail("TITLE_TOO_SHORT");

  const patch = {
    title: title.slice(0, 160),
    description: String(formData.get("description") ?? "").trim().slice(0, 2000) || null,
    visibility: formData.get("visibility") === "hidden" ? "hidden" : "visible",
  };

  const { error } = await supabase.from("course_files").update(patch).eq("id", id);
  if (error) return fail("UPDATE_FAILED", error.message);

  await logAudit({
    actorId: user.authId,
    actorRole: role,
    action: "course_file.update",
    entity: "course_files",
    entityId: id,
    metadata: { before: existing, after: patch },
    note: `Modification du document « ${patch.title} »`,
  });

  revalidatePath(`/formateur/formations/${existing.course_id}`);
  revalidatePath("/formateur/documents");
  return { ok: true, data: { id } };
}

// ---------------------------------------------------------------------------
// 3. Supprimer un document
// ---------------------------------------------------------------------------
export async function deleteCourseFileAction(fileId: string): Promise<ActionResult<{ id: string }>> {
  if (!fileId) return fail("FILE_REQUIRED");

  const user = await getCurrentUser();
  if (!user) return fail("AUTH_REQUIRED");
  const role = user.profile?.role;
  if (role !== "instructor" && role !== "admin") return fail("FORBIDDEN");

  const supabase = await createServerSupabase();
  const { data: existing } = await supabase
    .from("course_files")
    .select("id, course_id, storage_path, title, file_name")
    .eq("id", fileId)
    .maybeSingle();

  if (!existing) return fail("FILE_NOT_FOUND");

  const access = await requireCourseAccess(existing.course_id as string);
  if (access.error) return fail(access.error);

  const { error: deleteError } = await supabase.from("course_files").delete().eq("id", fileId);
  if (deleteError) return fail("DELETE_FAILED", deleteError.message);

  // Le fichier lui-même, pour ne pas laisser d'objet orphelin.
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([existing.storage_path as string]);

  await logAudit({
    actorId: user.authId,
    actorRole: role,
    action: "course_file.delete",
    entity: "course_files",
    entityId: fileId,
    metadata: {
      course_id: existing.course_id,
      file_name: existing.file_name,
      storage_removed: !storageError,
    },
    note: `Suppression du document « ${existing.title} »`,
  });

  revalidatePath(`/formateur/formations/${existing.course_id}`);
  revalidatePath("/formateur/documents");

  // La fiche est supprimée. Si le fichier est resté dans le stockage, on
  // renvoie quand même un succès (le document n'est plus visible) mais
  // l'information est consignée dans le journal d'audit ci-dessus.
  return { ok: true, data: { id: fileId } };
}

// ---------------------------------------------------------------------------
// 4. Lien de téléchargement (formateur / admin) — 5 minutes
// ---------------------------------------------------------------------------
export async function getCourseFileLinkAction(
  fileId: string,
): Promise<ActionResult<{ url: string; expiresInMinutes: number }>> {
  const user = await getCurrentUser();
  if (!user) return fail("AUTH_REQUIRED");

  const supabase = await createServerSupabase();
  const { data: file } = await supabase
    .from("course_files")
    .select("id, course_id, storage_path")
    .eq("id", fileId)
    .maybeSingle();

  if (!file) return fail("FILE_NOT_FOUND");

  // Un apprenant inscrit peut aussi demander un lien (voir la route dédiée),
  // mais ici on vérifie qu'il a un droit quelconque sur le cours.
  const access = await requireCourseAccess(file.course_id as string);
  if (access.error) {
    const enrolled = await userCanDownload(fileId, user.authId);
    if (!enrolled) return fail("FORBIDDEN");
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(file.storage_path as string, 300);

  if (error || !data) return fail("SIGN_FAILED", error?.message ?? "Lien indisponible.");
  return { ok: true, data: { url: data.signedUrl, expiresInMinutes: 5 } };
}

/** Contrôle d'accès apprenant, réutilisé par la route de téléchargement. */
async function userCanDownload(fileId: string, userId: string): Promise<boolean> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("course_files")
    .select("course_id, visibility")
    .eq("id", fileId)
    .maybeSingle();
  if (!data || data.visibility !== "visible") return false;

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("course_id", data.course_id as string)
    .eq("user_id", userId)
    .in("status", ["active", "completed"])
    .maybeSingle();

  return Boolean(enrollment);
}
