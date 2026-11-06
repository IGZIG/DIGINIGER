import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/auth";

/**
 * GET /api/documents/[id]/telecharger — lien de téléchargement d'un support.
 * ---------------------------------------------------------------------------
 * Le compartiment `course-files` est privé : aucun lien permanent n'existe.
 * Cette route délivre une URL signée valable 5 minutes, APRÈS avoir vérifié
 * les droits :
 *
 *   - administrateur                        → toujours autorisé ;
 *   - formateur propriétaire de la formation → autorisé (même si masqué) ;
 *   - apprenant inscrit (actif ou terminé)   → autorisé si le document est
 *                                              visible ;
 *   - toute autre personne                   → 403 ;
 *   - non connecté                           → 401.
 *
 * Chaque téléchargement d'un apprenant est compté (`download_count`) et
 * journalisé (`course_file_downloads`) : le formateur peut voir qui a
 * téléchargé quoi.
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });

  const supabase = await createServerSupabase();

  // La RLS ne renvoie déjà que ce que la personne a le droit de voir.
  const { data: file } = await supabase
    .from("course_files")
    .select("id, course_id, storage_path, file_name, visibility, download_count")
    .eq("id", id)
    .maybeSingle();

  if (!file) {
    // Fichier inexistant OU non visible pour cette personne : même réponse,
    // pour ne pas révéler l'existence d'un document d'un autre formateur.
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const role = user.profile?.role ?? "student";
  let allowed = role === "admin";

  if (!allowed && role === "instructor") {
    const { data: course } = await supabase
      .from("courses")
      .select("instructor_id")
      .eq("id", file.course_id as string)
      .maybeSingle();
    allowed = course?.instructor_id === user.authId;
  }

  if (!allowed) {
    // Apprenant : le document doit être visible ET la personne inscrite.
    allowed = file.visibility === "visible";
    if (allowed) {
      const { data: enrollment } = await supabase
        .from("enrollments")
        .select("id")
        .eq("course_id", file.course_id as string)
        .eq("user_id", user.authId)
        .in("status", ["active", "completed"])
        .maybeSingle();
      allowed = Boolean(enrollment);
    }
  }

  if (!allowed) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { data: signed, error } = await supabase.storage
    .from("course-files")
    .createSignedUrl(file.storage_path as string, 300);

  if (error || !signed) {
    return NextResponse.json(
      { error: "SIGN_FAILED", message: error?.message ?? "Lien indisponible." },
      { status: 500 },
    );
  }

  // --- Traçabilité (jamais bloquante) -------------------------------------
  try {
    await supabase
      .from("course_files")
      .update({ download_count: (file.download_count as number) + 1 })
      .eq("id", id);

    await createAdminClient().from("course_file_downloads").insert({
      file_id: id,
      profile_id: user.authId,
    });
  } catch {
    // Un incident de journalisation ne doit pas empêcher le téléchargement.
  }

  // On redirige vers le lien signé : le fichier n'est jamais servi par
  // l'application elle-même, ce qui évite de le charger en mémoire.
  return NextResponse.redirect(signed.signedUrl, { status: 302 });
}
