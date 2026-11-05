"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/actions/audit";
import type { ActionResult } from "@/lib/actions/learning";

/**
 * Server Actions de facturation — réservées à l'administrateur.
 * ---------------------------------------------------------------------------
 * Trois principes non négociables :
 *  1. Double barrière : rôle vérifié ici, RLS côté PostgreSQL. Un appel direct
 *     à l'API REST avec un jeton étudiant échoue aussi.
 *  2. Aucun montant fourni par le client n'est utilisé : tout est relu en base
 *     (montant de la transaction, prix de l'offre). Un formulaire bricolé ne
 *     peut donc ni offrir un abonnement ni gonfler un remboursement.
 *  3. Toute action modifiant de l'argent est journalisée dans `audit_logs`
 *     avec l'auteur, l'avant et l'après.
 */

/** Client service_role, ou null si la clé n'est pas configurée sur le serveur. */
function adminClientOrNull() {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

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

const UNAVAILABLE: ActionResult<never> = {
  ok: false,
  code: "CONFIG_UNAVAILABLE",
  message:
    "Clé de service absente sur le serveur : l'opération ne peut pas être tracée ni exécutée. Aucune modification n'a été appliquée.",
};

const REVALIDATE = ["/admin/abonnements", "/admin/paiements", "/admin"];

// ---------------------------------------------------------------------------
// Offres (plans)
// ---------------------------------------------------------------------------
const planSchema = z.object({
  id: z.string().uuid().optional(),
  code: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[a-z0-9-]+$/, "Code invalide : minuscules, chiffres et tirets uniquement."),
  name_fr: z.string().min(2).max(80),
  name_en: z.string().max(80).optional(),
  price_xof: z.number().int().min(0).max(100_000_000),
  // Enum PostgreSQL réel : billing_interval = {month, year, one_time}
  interval: z.enum(["month", "year", "one_time"]).default("month"),
  ai_messages_per_day: z.number().int().min(0).max(10_000),
  course_access: z.string().max(120).optional(),
  is_active: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  position: z.number().int().min(0).max(999).default(0),
});

export async function savePlanAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin();
  if (!admin) return DENIED;

  const parsed = planSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, code: "INVALID", message: parsed.error.errors[0].message };
  }

  const adminClient = adminClientOrNull();
  if (!adminClient) return UNAVAILABLE;

  const { id, ...fields } = parsed.data;
  const payload: Record<string, unknown> = {
    code: fields.code,
    name_fr: fields.name_fr,
    name_en: fields.name_en || fields.name_fr,
    price_xof: fields.price_xof,
    interval: fields.interval,
    ai_messages_per_day: fields.ai_messages_per_day,
    course_access: fields.course_access ?? null,
    is_active: fields.is_active,
    is_featured: fields.is_featured,
    position: fields.position,
  };
  // À la création seulement : description et avantages sont repris des
  // valeurs par défaut de la base, on ne les écrase pas sur une modification.
  if (!id) {
    payload.audience = "student";
    payload.description_fr = null;
    payload.description_en = null;
    payload.features_fr = [];
    payload.features_en = [];
  }

  // Lecture de l'état précédent pour le journal (offre existante ?)
  let before: Record<string, unknown> | null = null;
  if (id) {
    const { data } = await adminClient.from("plans").select("*").eq("id", id).maybeSingle();
    before = data ?? null;
    if (!before) {
      return { ok: false, code: "NOT_FOUND", message: "Cette offre n'existe pas." };
    }
  }

  const query = id
    ? adminClient.from("plans").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", id).select("id").single()
    : adminClient.from("plans").insert(payload).select("id").single();

  const { data, error } = await query;

  if (error) {
    if (error.code === "23505") {
      return { ok: false, code: "DUPLICATE", message: "Ce code d'offre est déjà utilisé." };
    }
    return { ok: false, code: "DB_ERROR", message: "Enregistrement impossible." };
  }

  await logAudit({
    actorId: admin.authId,
    actorRole: admin.profile?.role ?? "admin",
    action: id ? "plan.update" : "plan.create",
    entity: "plans",
    entityId: data.id,
    metadata: { before, after: payload },
  });

  REVALIDATE.forEach((path) => revalidatePath(path));
  revalidatePath("/tarifs");
  return { ok: true, data: { id: data.id } };
}

export async function togglePlanAction(
  planId: string,
  active: boolean,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return DENIED;
  if (!z.string().uuid().safeParse(planId).success) {
    return { ok: false, code: "INVALID", message: "Offre invalide." };
  }

  const adminClient = adminClientOrNull();
  if (!adminClient) return UNAVAILABLE;

  const { data, error } = await adminClient
    .from("plans")
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq("id", planId)
    .select("code, is_active")
    .single();

  if (error) return { ok: false, code: "DB_ERROR", message: "Modification impossible." };

  await logAudit({
    actorId: admin.authId,
    actorRole: admin.profile?.role ?? "admin",
    action: active ? "plan.activate" : "plan.deactivate",
    entity: "plans",
    entityId: planId,
    metadata: { code: data.code, is_active: data.is_active },
  });

  REVALIDATE.forEach((path) => revalidatePath(path));
  revalidatePath("/tarifs");
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Abonnements
// ---------------------------------------------------------------------------
/**
 * Octroi manuel d'un abonnement (geste commercial, virement reçu hors
 * plateforme, correction après incident). Le montant n'est jamais saisi : il
 * est repris du prix de l'offre, et une trace `granted_by_admin` est écrite.
 */
export async function grantSubscriptionAction(
  raw: unknown,
): Promise<ActionResult<{ subscriptionId: string }>> {
  const admin = await requireAdmin();
  if (!admin) return DENIED;

  const parsed = z
    .object({
      userId: z.string().uuid(),
      planId: z.string().uuid(),
      months: z.number().int().min(1).max(36).default(1),
      reason: z.string().min(5).max(300),
    })
    .safeParse(raw);

  if (!parsed.success) {
    return { ok: false, code: "INVALID", message: parsed.error.errors[0].message };
  }

  const adminClient = adminClientOrNull();
  if (!adminClient) return UNAVAILABLE;

  const { userId, planId, months, reason } = parsed.data;

  const [{ data: plan }, { data: profile }] = await Promise.all([
    adminClient.from("plans").select("id, code, name_fr, price_xof, interval, is_active").eq("id", planId).maybeSingle(),
    adminClient.from("profiles").select("id, role, full_name, email").eq("id", userId).maybeSingle(),
  ]);

  if (!plan) return { ok: false, code: "NOT_FOUND", message: "Offre introuvable." };
  if (!plan.is_active) {
    return { ok: false, code: "INACTIVE_PLAN", message: "Cette offre est désactivée." };
  }
  if (!profile) return { ok: false, code: "NOT_FOUND", message: "Compte introuvable." };
  if (profile.role !== "student") {
    return {
      ok: false,
      code: "WRONG_ROLE",
      message: "Un abonnement ne s'applique qu'à un compte apprenant.",
    };
  }
  if (plan.code === "free" || plan.price_xof === 0) {
    return {
      ok: false,
      code: "FREE_PLAN",
      message: "L'offre gratuite n'a pas besoin d'être octroyée : elle est automatique.",
    };
  }

  const now = new Date();
  const end = new Date(now);
  end.setMonth(end.getMonth() + months);

  const { data: subscription, error } = await adminClient
    .from("subscriptions")
    .insert({
      user_id: userId,
      plan_id: planId,
      status: "active",
      current_period_start: now.toISOString(),
      current_period_end: end.toISOString(),
      provider: "manual",
      provider_ref: `admin:${admin.authId.slice(0, 8)}:${Date.now().toString(36)}`,
    })
    .select("id")
    .single();

  if (error || !subscription) {
    return { ok: false, code: "DB_ERROR", message: "Création impossible." };
  }

  await logAudit({
    actorId: admin.authId,
    actorRole: admin.profile?.role ?? "admin",
    action: "subscription.grant",
    entity: "subscriptions",
    entityId: subscription.id,
    metadata: {
      user_id: userId,
      user_email: profile.email,
      plan: plan.code,
      months,
      amount_xof: plan.price_xof * months,
      reason,
    },
  });

  REVALIDATE.forEach((path) => revalidatePath(path));
  return { ok: true, data: { subscriptionId: subscription.id } };
}

export async function setSubscriptionStatusAction(
  subscriptionId: string,
  status: "active" | "canceled" | "past_due" | "expired",
  reason: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return DENIED;
  if (!z.string().uuid().safeParse(subscriptionId).success) {
    return { ok: false, code: "INVALID", message: "Abonnement invalide." };
  }
  if (reason.trim().length < 5) {
    return { ok: false, code: "INVALID", message: "Indiquez un motif (5 caractères minimum)." };
  }

  const adminClient = adminClientOrNull();
  if (!adminClient) return UNAVAILABLE;

  const { data: before } = await adminClient
    .from("subscriptions")
    .select("id, status, plan_id, user_id")
    .eq("id", subscriptionId)
    .maybeSingle();

  if (!before) return { ok: false, code: "NOT_FOUND", message: "Abonnement introuvable." };

  const { error } = await adminClient
    .from("subscriptions")
    .update({
      status,
      canceled_at: status === "canceled" ? new Date().toISOString() : null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscriptionId);

  if (error) return { ok: false, code: "DB_ERROR", message: "Modification impossible." };

  await logAudit({
    actorId: admin.authId,
    actorRole: admin.profile?.role ?? "admin",
    action: "subscription.status",
    entity: "subscriptions",
    entityId: subscriptionId,
    metadata: { before: before.status, after: status, reason },
  });

  REVALIDATE.forEach((path) => revalidatePath(path));
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Règlements (transactions)
// ---------------------------------------------------------------------------
/**
 * Marque un règlement comme vérifié, ou l'annule.
 *
 * Règle : on ne peut vérifier qu'un règlement réellement encaissé
 * (`status = paid`). Un règlement `pending` ne doit jamais être « vérifié » :
 * cela ouvrirait un accès sans argent reçu. Le montant utilisé pour
 * l'abonnement est celui de la transaction en base, jamais une saisie.
 */
export async function reviewSettlementAction(
  raw: unknown,
): Promise<ActionResult<{ status: string }>> {
  const admin = await requireAdmin();
  if (!admin) return DENIED;

  const parsed = z
    .object({
      transactionId: z.string().uuid(),
      decision: z.enum(["verify", "reject"]),
      note: z.string().max(300).optional(),
    })
    .safeParse(raw);

  if (!parsed.success) {
    return { ok: false, code: "INVALID", message: parsed.error.errors[0].message };
  }

  const { transactionId, decision, note } = parsed.data;
  const adminClient = adminClientOrNull();
  if (!adminClient) return UNAVAILABLE;

  const { data: transaction } = await adminClient
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .maybeSingle();

  if (!transaction) {
    return { ok: false, code: "NOT_FOUND", message: "Règlement introuvable." };
  }

  const metadata = (transaction.metadata ?? {}) as Record<string, unknown>;

  // --- Refus : aucun mouvement d'argent, l'accès reste fermé --------------
  if (decision === "reject") {
    if (transaction.status === "paid") {
      return {
        ok: false,
        code: "ALREADY_PAID",
        message:
          "Ce règlement est déjà encaissé : utilisez un remboursement pour rendre l'argent, plutôt qu'un rejet.",
      };
    }

    const { error } = await adminClient
      .from("transactions")
      .update({
        status: "failed",
        metadata: { ...metadata, admin_review: { by: admin.authId, at: new Date().toISOString(), note: note ?? null, decision: "reject" } },
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId);

    if (error) return { ok: false, code: "DB_ERROR", message: "Enregistrement impossible." };

    await logAudit({
      actorId: admin.authId,
      action: "settlement.reject",
      entity: "transactions",
      entityId: transactionId,
      metadata: { reference: transaction.reference, total_xof: transaction.total_xof, note: note ?? null },
    });

    REVALIDATE.forEach((path) => revalidatePath(path));
    return { ok: true, data: { status: "failed" } };
  }

  // --- Vérification : uniquement sur un paiement réellement encaissé ------
  if (transaction.status !== "paid") {
    return {
      ok: false,
      code: "NOT_PAID",
      message:
        "Seul un règlement confirmé par le fournisseur peut être vérifié. Ce règlement est encore « en attente » : l'argent n'est pas encaissé.",
    };
  }

  const { error } = await adminClient
    .from("transactions")
    .update({
      metadata: {
        ...metadata,
        admin_review: { by: admin.authId, at: new Date().toISOString(), note: note ?? null, decision: "verify" },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", transactionId);

  if (error) return { ok: false, code: "DB_ERROR", message: "Enregistrement impossible." };

  await logAudit({
    actorId: admin.authId,
    actorRole: admin.profile?.role ?? "admin",
    action: "settlement.verify",
    entity: "transactions",
    entityId: transactionId,
    metadata: {
      reference: transaction.reference,
      total_xof: transaction.total_xof,
      provider: transaction.provider,
      provider_ref: transaction.provider_ref,
      note: note ?? null,
    },
  });

  REVALIDATE.forEach((path) => revalidatePath(path));
  return { ok: true, data: { status: "verified" } };
}

/**
 * Enregistre un règlement reçu hors plateforme (virement, espèces, mobile
 * money direct) puis ouvre l'accès si c'est un abonnement.
 *
 * Le montant est saisi (c'est la réalité de l'encaissement), mais il est
 * enregistré tel quel dans la transaction : aucun accès n'est ouvert sans que
 * la ligne existe en base et soit tracée dans le journal.
 */
export async function recordManualSettlementAction(
  raw: unknown,
): Promise<ActionResult<{ reference: string }>> {
  const admin = await requireAdmin();
  if (!admin) return DENIED;

  const parsed = z
    .object({
      userId: z.string().uuid(),
      planId: z.string().uuid().optional(),
      amountXof: z.number().int().min(1).max(100_000_000),
      method: z.enum(["cash", "bank_transfer", "mobile_money", "cheque"]),
      reference: z.string().min(3).max(80),
      note: z.string().max(300).optional(),
      activateSubscription: z.boolean().default(false),
      months: z.number().int().min(1).max(36).default(1),
    })
    .safeParse(raw);

  if (!parsed.success) {
    return { ok: false, code: "INVALID", message: parsed.error.errors[0].message };
  }

  const adminClient = adminClientOrNull();
  if (!adminClient) return UNAVAILABLE;

  const data = parsed.data;

  if (data.activateSubscription && !data.planId) {
    return {
      ok: false,
      code: "INVALID",
      message: "Choisissez l'offre à activer, ou décochez l'activation.",
    };
  }

  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, email, role")
    .eq("id", data.userId)
    .maybeSingle();

  if (!profile) return { ok: false, code: "NOT_FOUND", message: "Compte introuvable." };

  const internalReference = `MAN-${Date.now().toString(36).toUpperCase()}-${admin.authId.slice(0, 4).toUpperCase()}`;

  const { error: insertError } = await adminClient.from("transactions").insert({
    reference: internalReference,
    user_id: data.userId,
    plan_id: data.planId ?? null,
    amount_xof: data.amountXof,
    discount_xof: 0,
    total_xof: data.amountXof,
    currency: "XOF",
    provider: "manual",
    provider_ref: data.reference,
    status: "paid",
    paid_at: new Date().toISOString(),
    metadata: {
      manual_method: data.method,
      external_reference: data.reference,
      note: data.note ?? null,
      recorded_by: admin.authId,
    },
  });

  if (insertError) {
    return { ok: false, code: "DB_ERROR", message: "Enregistrement du règlement impossible." };
  }

  // Activation facultative de l'abonnement, à partir du prix en base
  if (data.activateSubscription && data.planId) {
    const { data: plan } = await adminClient
      .from("plans")
      .select("price_xof, code, is_active")
      .eq("id", data.planId)
      .maybeSingle();

    if (plan && plan.is_active && plan.price_xof > 0) {
      if (data.amountXof < plan.price_xof) {
        // Le règlement est enregistré, mais l'abonnement reste fermé : le
        // montant reçu ne couvre pas l'offre. On journalise le refus.
        await logAudit({
          actorId: admin.authId,
          actorRole: admin.profile?.role ?? "admin",
          action: "subscription.grant_refused",
          entity: "transactions",
          entityId: internalReference,
          metadata: {
            reason: "AMOUNT_BELOW_PLAN_PRICE",
            amount_received: data.amountXof,
            plan_price: plan.price_xof,
            plan: plan.code,
          },
        });
        REVALIDATE.forEach((path) => revalidatePath(path));
        return {
          ok: false,
          code: "AMOUNT_BELOW_PLAN_PRICE",
          message: `Règlement enregistré, mais l'abonnement n'a PAS été activé : montant reçu (${data.amountXof} XOF) inférieur au prix de l'offre (${plan.price_xof} XOF).`,
        };
      }

      const now = new Date();
      const end = new Date(now);
      end.setMonth(end.getMonth() + data.months);

      await adminClient.from("subscriptions").insert({
        user_id: data.userId,
        plan_id: data.planId,
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: end.toISOString(),
        provider: "manual",
        provider_ref: internalReference,
      });
    }
  }

  await logAudit({
    actorId: admin.authId,
    actorRole: admin.profile?.role ?? "admin",
    action: "settlement.record",
    entity: "transactions",
    entityId: internalReference,
    metadata: {
      user_id: data.userId,
      user_email: profile.email,
      amount_xof: data.amountXof,
      method: data.method,
      external_reference: data.reference,
      subscription_activated: data.activateSubscription,
    },
  });

  REVALIDATE.forEach((path) => revalidatePath(path));
  return { ok: true, data: { reference: internalReference } };
}

// ---------------------------------------------------------------------------
// Analyse SaaS : séries mensuelles pour la prise de décision
// ---------------------------------------------------------------------------
export interface SaasSnapshot {
  mrrXof: number;
  activeSubscriptions: number;
  pastDue: number;
  canceled30d: number;
  totalStudents: number;
  payingStudents: number;
  conversionPct: number;
  revenueThisMonthXof: number;
  revenueLastMonthXof: number;
  growthPct: number | null;
  pendingSettlements: number;
  refundedThisMonthXof: number;
  verifiedSettlements: number;
  unverifiedSettlements: number;
  byMethod: Array<{ method: string; count: number; amountXof: number }>;
  byPlan: Array<{ plan: string; count: number; mrrXof: number }>;
  monthly: Array<{ month: string; revenueXof: number; subscriptions: number }>;
}

export async function getSaasSnapshotAction(): Promise<ActionResult<SaasSnapshot>> {
  const admin = await requireAdmin();
  if (!admin) return DENIED;

  const adminClient = adminClientOrNull();
  if (!adminClient) return UNAVAILABLE;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const start30d = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

  const [{ data: plans }, { data: subscriptions }, { data: transactions }, { count: totalStudents }] =
    await Promise.all([
      adminClient.from("plans").select("id, code, name_fr, price_xof, interval, is_active"),
      adminClient
        .from("subscriptions")
        .select("id, status, plan_id, user_id, current_period_end, canceled_at, created_at"),
      adminClient
        .from("transactions")
        .select("id, status, total_xof, provider, plan_id, created_at, paid_at, metadata")
        .order("created_at", { ascending: false })
        .limit(2000),
      adminClient.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
    ]);

  const planById = new Map((plans ?? []).map((plan) => [plan.id, plan]));
  const subs = subscriptions ?? [];
  const tx = transactions ?? [];

  const activeSubs = subs.filter((s) => s.status === "active" && (!s.current_period_end || new Date(s.current_period_end) > now));
  const mrrXof = activeSubs.reduce((sum, s) => sum + (planById.get(s.plan_id)?.price_xof ?? 0), 0);

  const paid = tx.filter((t) => t.status === "paid");
  const revenueOf = (from: Date, to?: Date) =>
    paid
      .filter((t) => {
        const at = new Date(t.paid_at ?? t.created_at);
        return at >= from && (!to || at < to);
      })
      .reduce((sum, t) => sum + (t.total_xof ?? 0), 0);

  const revenueThisMonthXof = revenueOf(startOfMonth);
  const revenueLastMonthXof = revenueOf(startOfLastMonth, startOfMonth);
  const growthPct =
    revenueLastMonthXof > 0
      ? Math.round(((revenueThisMonthXof - revenueLastMonthXof) / revenueLastMonthXof) * 1000) / 10
      : null;

  const payingStudents = new Set(activeSubs.map((s) => s.user_id)).size;
  const students = totalStudents ?? 0;

  // Répartition par moyen d'encaissement
  const methodMap = new Map<string, { count: number; amountXof: number }>();
  for (const t of paid) {
    const method = String(t.provider ?? "inconnu");
    const entry = methodMap.get(method) ?? { count: 0, amountXof: 0 };
    entry.count += 1;
    entry.amountXof += t.total_xof ?? 0;
    methodMap.set(method, entry);
  }

  // Répartition par offre (MRR)
  const planMap = new Map<string, { count: number; mrrXof: number }>();
  for (const s of activeSubs) {
    const plan = planById.get(s.plan_id);
    const label = plan?.name_fr ?? "Offre supprimée";
    const entry = planMap.get(label) ?? { count: 0, mrrXof: 0 };
    entry.count += 1;
    entry.mrrXof += plan?.price_xof ?? 0;
    planMap.set(label, entry);
  }

  // Série des 6 derniers mois
  const monthly: Array<{ month: string; revenueXof: number; subscriptions: number }> = [];
  for (let index = 5; index >= 0; index -= 1) {
    const from = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const to = new Date(now.getFullYear(), now.getMonth() - index + 1, 1);
    const label = from.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
    monthly.push({
      month: label,
      revenueXof: revenueOf(from, to),
      subscriptions: subs.filter((s) => {
        const at = new Date(s.created_at);
        return at >= from && at < to;
      }).length,
    });
  }

  const verifiedSettlements = paid.filter(
    (t) => (t.metadata as Record<string, any>)?.admin_review?.decision === "verify",
  ).length;

  const refundedThisMonthXof = tx
    .filter((t) => t.status === "refunded" && new Date(t.created_at) >= startOfMonth)
    .reduce((sum, t) => sum + (t.total_xof ?? 0), 0);

  return {
    ok: true,
    data: {
      mrrXof,
      activeSubscriptions: activeSubs.length,
      pastDue: subs.filter((s) => s.status === "past_due").length,
      canceled30d: subs.filter((s) => s.status === "canceled" && s.canceled_at && new Date(s.canceled_at) >= start30d).length,
      totalStudents: students,
      payingStudents,
      conversionPct: students > 0 ? Math.round((payingStudents / students) * 1000) / 10 : 0,
      revenueThisMonthXof,
      revenueLastMonthXof,
      growthPct,
      pendingSettlements: tx.filter((t) => t.status === "pending").length,
      refundedThisMonthXof,
      verifiedSettlements,
      unverifiedSettlements: paid.length - verifiedSettlements,
      byMethod: [...methodMap.entries()].map(([method, value]) => ({ method, ...value })),
      byPlan: [...planMap.entries()].map(([plan, value]) => ({ plan, ...value })),
      monthly,
    },
  };
}
