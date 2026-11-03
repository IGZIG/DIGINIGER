import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/auth";
import { checkoutSchema } from "@/lib/validation";
import { getPaymentAdapter } from "@/lib/payments/provider";

/**
 * POST /api/payments/checkout
 * ---------------------------------------------------------------------------
 * Crée une transaction 'pending' avec un montant CALCULÉ CÔTÉ SERVEUR
 * (jamais celui envoyé par le client), puis initie le paiement chez le
 * fournisseur. L'accès n'est ouvert qu'à la réception du webhook signé.
 */
export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  // Limitation : 10 tentatives de paiement par utilisateur et par heure
  const admin = createAdminClient();
  const { data: allowed } = await admin.rpc("take_rate_limit", {
    p_key: `checkout:${user.authId}`,
    p_limit: 10,
    p_window_seconds: 3600,
  });
  if (allowed === false) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: parsed.error.errors[0].message },
      { status: 422 },
    );
  }

  const { planId, courseId, promoCode, provider, phone } = parsed.data;

  if (!planId && !courseId) {
    return NextResponse.json({ error: "MISSING_TARGET" }, { status: 422 });
  }

  const supabase = await createServerSupabase();

  // --- Montant de référence, lu en base (jamais depuis le client) ----------
  let amountXof = 0;
  let description = "";

  if (planId) {
    const { data: plan } = await supabase
      .from("plans")
      .select("id, name_fr, price_xof, is_active, interval")
      .eq("id", planId)
      .eq("is_active", true)
      .maybeSingle();

    if (!plan) {
      return NextResponse.json({ error: "PLAN_NOT_FOUND" }, { status: 404 });
    }
    if (plan.price_xof <= 0) {
      return NextResponse.json({ error: "PLAN_IS_FREE" }, { status: 409 });
    }
    amountXof = plan.price_xof;
    description = `Abonnement ${plan.name_fr} — DIGINIGER`;
  }

  if (courseId) {
    const { data: course } = await supabase
      .from("courses")
      .select("id, title_fr, price_xof, is_free, status")
      .eq("id", courseId)
      .eq("status", "published")
      .maybeSingle();

    if (!course) {
      return NextResponse.json({ error: "COURSE_NOT_FOUND" }, { status: 404 });
    }
    if (course.is_free || course.price_xof <= 0) {
      return NextResponse.json({ error: "COURSE_IS_FREE" }, { status: 409 });
    }

    // Déjà inscrit ? Aucun paiement à effectuer.
    const { data: existing } = await supabase
      .from("enrollments")
      .select("id")
      .eq("user_id", user.authId)
      .eq("course_id", courseId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "ALREADY_ENROLLED" }, { status: 409 });
    }

    amountXof = course.price_xof;
    description = `Formation ${course.title_fr} — DIGINIGER`;
  }

  // --- Code promo (validation serveur via RPC) -----------------------------
  let discountXof = 0;
  let promoId: string | null = null;

  if (promoCode) {
    const { data: promo } = await admin.rpc("promo_discount", {
      p_code: promoCode,
      p_plan_id: planId ?? null,
      p_amount: amountXof,
    });
    const row = Array.isArray(promo) ? promo[0] : null;
    if (row) {
      discountXof = Number(row.discount ?? 0);
      promoId = row.promo_id ?? null;
    }
  }

  const totalXof = Math.max(amountXof - discountXof, 1);
  const reference = `DIG-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;

  const adapter = getPaymentAdapter(provider);
  if (!adapter.isConfigured()) {
    // Aucun faux succès : on refuse explicitement.
    return NextResponse.json(
      {
        error: "PAYMENT_NOT_CONFIGURED",
        message:
          "Le paiement en ligne n'est pas encore configuré sur cette installation. Contactez l'administrateur ou réglez par un autre moyen.",
      },
      { status: 503 },
    );
  }

  const origin = new URL(request.url).origin;

  // --- Transaction enregistrée AVANT l'appel fournisseur -------------------
  const { data: transaction, error: insertError } = await supabase
    .from("transactions")
    .insert({
      reference,
      user_id: user.authId,
      plan_id: planId ?? null,
      course_id: courseId ?? null,
      promo_code_id: promoId,
      amount_xof: amountXof,
      discount_xof: discountXof,
      total_xof: totalXof,
      provider,
      status: "pending",
      metadata: { description, phone: phone ?? null },
    })
    .select("id, reference")
    .single();

  if (insertError || !transaction) {
    return NextResponse.json({ error: "TRANSACTION_CREATE_FAILED" }, { status: 500 });
  }

  try {
    const init = await adapter.initiate({
      reference,
      amountXof: totalXof,
      description,
      customerEmail: user.email ?? "",
      customerPhone: phone ?? null,
      returnUrl: `${origin}/paiement/retour?ref=${reference}`,
      cancelUrl: `${origin}/paiement/annule?ref=${reference}`,
      notifyUrl: `${origin}/api/payments/webhook?provider=${provider}`,
    });

    await supabase
      .from("transactions")
      .update({ provider_ref: init.providerRef })
      .eq("id", transaction.id);

    return NextResponse.json({
      reference,
      redirectUrl: init.redirectUrl,
      instructions: init.instructions ?? null,
      totalXof,
      discountXof,
    });
  } catch (error) {
    await supabase
      .from("transactions")
      .update({ status: "failed", metadata: { description, error: String(error) } })
      .eq("id", transaction.id);

    return NextResponse.json(
      { error: "PAYMENT_INIT_FAILED", message: "Le fournisseur de paiement n'a pas répondu." },
      { status: 502 },
    );
  }
}
