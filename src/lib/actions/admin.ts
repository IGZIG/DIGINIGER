"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import type { ActionResult } from "@/lib/actions/learning";

/**
 * Server Actions d'administration.
 * Double barrière : ce module vérifie le rôle en base, et la RLS PostgreSQL
 * n'autorise ces opérations qu'à un profil `admin`. Un appel direct à l'API
 * REST avec un jeton étudiant échouerait donc aussi.
 */

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.profile?.role !== "admin") return null;
  return user;
}

const DENIED: ActionResult<never> = {
  ok: false,
  code: "FORBIDDEN",
  message: "Action réservée aux administrateurs.",
};

// ---------------------------------------------------------------------------
// Formations : validation éditoriale
// ---------------------------------------------------------------------------
export async function reviewCourseAction(
  courseId: string,
  decision: "publish" | "reject" | "archive",
): Promise<ActionResult<{ status: string }>> {
  const admin = await requireAdmin();
  if (!admin) return DENIED;

  if (!z.string().uuid().safeParse(courseId).success) {
    return { ok: false, code: "INVALID", message: "Formation invalide." };
  }
  if (!["publish", "reject", "archive"].includes(decision)) {
    return { ok: false, code: "INVALID", message: "Décision invalide." };
  }

  const supabase = await createServerSupabase();

  // Une formation ne peut être publiée que si elle contient au moins une leçon :
  // sinon les apprenants auraient une progression impossible à calculer.
  if (decision === "publish") {
    const { data: modules } = await supabase.from("modules").select("id").eq("course_id", courseId);
    const moduleIds = (modules ?? []).map((module) => module.id);

    const { count } = moduleIds.length
      ? await supabase
          .from("lessons")
          .select("id", { count: "exact", head: true })
          .in("module_id", moduleIds)
      : { count: 0 };

    if (!count) {
      return {
        ok: false,
        code: "EMPTY_COURSE",
        message: "Impossible de publier : la formation ne contient aucune leçon.",
      };
    }
  }

  const { error } = await supabase
    .from("courses")
    .update({
      status:
        decision === "publish" ? "published" : decision === "archive" ? "archived" : "draft",
      published_at: decision === "publish" ? new Date().toISOString() : null,
    })
    .eq("id", courseId);

  if (error) return { ok: false, code: "DB_ERROR", message: "Mise à jour impossible." };

  revalidatePath("/admin/formations");
  revalidatePath("/admin");
  revalidatePath("/formations");
  return { ok: true, data: { status: decision } };
}

/** Validation de toutes les évaluations d'une formation en une action. */
export async function publishCourseAssessmentsAction(
  courseId: string,
): Promise<ActionResult<{ published: number }>> {
  const admin = await requireAdmin();
  if (!admin) return DENIED;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("exercises")
    .update({ is_published: true })
    .eq("course_id", courseId)
    .select("id");

  if (error) return { ok: false, code: "DB_ERROR", message: "Publication impossible." };

  revalidatePath("/admin/formations");
  return { ok: true, data: { published: (data ?? []).length } };
}

// ---------------------------------------------------------------------------
// Utilisateurs et rôles
// ---------------------------------------------------------------------------
export async function updateUserRoleAction(
  userId: string,
  role: "student" | "instructor" | "admin",
): Promise<ActionResult<{ role: string }>> {
  const admin = await requireAdmin();
  if (!admin) return DENIED;

  if (!z.string().uuid().safeParse(userId).success) {
    return { ok: false, code: "INVALID", message: "Utilisateur invalide." };
  }

  // Garde-fou : un administrateur ne peut pas se retirer lui-même ses droits,
  // pour éviter de se verrouiller hors de l'administration.
  if (userId === admin.authId) {
    return {
      ok: false,
      code: "SELF_DEMOTION",
      message: "Vous ne pouvez pas modifier votre propre rôle.",
    };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);

  if (error) return { ok: false, code: "DB_ERROR", message: "Modification impossible." };

  await supabase.rpc("log_audit", {
    p_action: "user.role_updated",
    p_entity: "profiles",
    p_entity_id: userId,
    p_metadata: { role },
  });

  revalidatePath("/admin/utilisateurs");
  return { ok: true, data: { role } };
}

// ---------------------------------------------------------------------------
// Demandes entrantes
// ---------------------------------------------------------------------------
export async function updateApplicationStatusAction(
  applicationId: string,
  status: "new" | "reviewing" | "accepted" | "rejected",
): Promise<ActionResult<{ status: string }>> {
  const admin = await requireAdmin();
  if (!admin) return DENIED;

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("application_requests")
    .update({ status })
    .eq("id", applicationId);

  if (error) return { ok: false, code: "DB_ERROR", message: "Mise à jour impossible." };

  revalidatePath("/admin/demandes");
  return { ok: true, data: { status } };
}

// ---------------------------------------------------------------------------
// Contenus IA
// ---------------------------------------------------------------------------
export async function reviewGenerationAction(
  generationId: string,
  decision: "accept" | "reject",
): Promise<ActionResult<{ status: string }>> {
  const admin = await requireAdmin();
  if (!admin) return DENIED;

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("course_generations")
    .update({ status: decision === "accept" ? "ready" : "rejected" })
    .eq("id", generationId);

  if (error) return { ok: false, code: "DB_ERROR", message: "Mise à jour impossible." };

  revalidatePath("/admin/contenus-ia");
  return { ok: true, data: { status: decision } };
}

// ---------------------------------------------------------------------------
// Remboursements
// ---------------------------------------------------------------------------
export async function processRefundAction(
  refundId: string,
  approve: boolean,
  note?: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return DENIED;

  if (!z.string().uuid().safeParse(refundId).success) {
    return { ok: false, code: "INVALID", message: "Remboursement invalide." };
  }

  // process_refund est réservé au service_role (il modifie la transaction et
  // révoque l'accès de façon atomique). On ne peut donc pas y accéder avec la
  // session de l'admin : on utilise le client serveur, après vérification du
  // rôle ci-dessus.
  const adminClient = createAdminClient();
  const { error } = await adminClient.rpc("process_refund", {
    p_refund_id: refundId,
    p_admin_id: admin.authId,
    p_approve: approve,
    p_note: note ?? null,
  });

  if (error) {
    return {
      ok: false,
      code: "DB_ERROR",
      message:
        error.message === "REFUND_NOT_FOUND"
          ? "Remboursement introuvable."
          : "Traitement impossible.",
    };
  }

  revalidatePath("/admin/paiements");
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Codes promotionnels
// ---------------------------------------------------------------------------
export async function createPromoCodeAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin();
  if (!admin) return DENIED;

  const parsed = z
    .object({
      code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/),
      kind: z.enum(["percent", "amount"]),
      value: z.coerce.number().int().min(1).max(100000),
      maxRedemptions: z.coerce.number().int().min(1).max(100000),
    })
    .safeParse({
      code: formData.get("code"),
      kind: formData.get("kind"),
      value: formData.get("value"),
      maxRedemptions: formData.get("maxRedemptions") ?? 100,
    });

  if (!parsed.success) {
    return { ok: false, code: "INVALID", message: parsed.error.errors[0].message };
  }

  const { kind, value } = parsed.data;
  if (kind === "percent" && value > 100) {
    return { ok: false, code: "INVALID", message: "Un pourcentage ne peut dépasser 100." };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("promo_codes")
    .insert({
      code: parsed.data.code.toUpperCase(),
      kind,
      value,
      max_redemptions: parsed.data.maxRedemptions,
    })
    .select("id")
    .single();

  if (error) {
    return {
      ok: false,
      code: error.code === "23505" ? "DUPLICATE" : "DB_ERROR",
      message: error.code === "23505" ? "Ce code existe déjà." : "Création impossible.",
    };
  }

  revalidatePath("/admin/paiements");
  return { ok: true, data: { id: data.id } };
}

export async function togglePromoCodeAction(
  promoId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return DENIED;

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("promo_codes").update({ is_active: isActive }).eq("id", promoId);

  if (error) return { ok: false, code: "DB_ERROR", message: "Mise à jour impossible." };

  revalidatePath("/admin/paiements");
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Certificats
// ---------------------------------------------------------------------------
export async function revokeCertificateAction(
  certificateId: string,
  reason: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return DENIED;

  const parsed = z.string().trim().min(5).max(300).safeParse(reason);
  if (!parsed.success) {
    return { ok: false, code: "INVALID", message: "Motif requis (5 caractères minimum)." };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("certificates")
    .update({ revoked_at: new Date().toISOString(), revoke_reason: parsed.data })
    .eq("id", certificateId);

  if (error) return { ok: false, code: "DB_ERROR", message: "Révocation impossible." };

  await supabase.rpc("log_audit", {
    p_action: "certificate.revoked",
    p_entity: "certificates",
    p_entity_id: certificateId,
    p_metadata: { reason: parsed.data },
  });

  revalidatePath("/admin/certificats");
  return { ok: true, data: undefined };
}
