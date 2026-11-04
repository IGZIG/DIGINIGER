import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentAdapter, type ProviderName } from "@/lib/payments/provider";

/**
 * Webhook de paiement : POST /api/payments/webhook?provider=mobile_money|card
 * (PayDunya et CinetPay envoient parfois un GET de contrôle : il est accepté
 * et renvoie simplement 200 sans rien traiter.)
 * ---------------------------------------------------------------------------
 * Séquence de sécurité :
 *  1. lecture du corps BRUT (indispensable pour la signature) ;
 *  2. premier filtre d'authenticité de la notification (signature HMAC ou
 *     hash PayDunya) — rejet 401 sinon ;
 *  3. idempotence via payment_events.event_id (contrainte UNIQUE) ;
 *  4. **confirmation serveur-à-serveur** auprès du fournisseur : c'est la
 *     seule source qui fait foi pour le statut et le montant. Chez PayDunya le
 *     hash d'IPN est statique (SHA-512 de la master key), donc une notification
 *     parfaitement « valide » peut être forgée : elle n'ouvre rien à elle seule ;
 *  5. comparaison du montant confirmé avec le montant enregistré en base ;
 *  6. ouverture de l'accès (abonnement ou inscription) en service_role ;
 *  7. réponse 200 rapide ; 502 si la confirmation est injoignable, pour que
 *     le fournisseur rejoue la notification plus tard.
 */
/**
 * CinetPay envoie d'abord une requête GET de contrôle sur l'adresse de
 * notification avant d'envoyer le POST. Elle doit recevoir un 200 immédiat,
 * sinon la notification n'est jamais transmise. Aucun traitement financier
 * n'a lieu ici : le POST (confirmé serveur-à-serveur) seul ouvre un accès.
 */
export async function GET() {
  const adapter = getPaymentAdapter("mobile_money");
  const host = adapter.vendor === "cinetpay" ? "cinetpay" : adapter.vendor;
  return NextResponse.json({
    ok: true,
    endpoint: "payments/webhook",
    vendor: adapter.vendor,
    configured: adapter.isConfigured(),
    confirmationRequired: true,
    note: `${host} : notification reçue. Le statut réel est toujours vérifié auprès du fournisseur.`,
  });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const provider = (url.searchParams.get("provider") ?? "mobile_money") as ProviderName;

  if (provider !== "mobile_money" && provider !== "card") {
    return NextResponse.json({ error: "UNKNOWN_PROVIDER" }, { status: 400 });
  }

  const rawBody = await request.text();
  const adapter = getPaymentAdapter(provider);

  if (!adapter.isConfigured()) {
    // Le fournisseur n'est pas configuré : on ne traite rien.
    return NextResponse.json({ error: "PAYMENT_NOT_CONFIGURED" }, { status: 503 });
  }

  if (!adapter.verifySignature(rawBody, request.headers)) {
    console.warn("[webhook] notification non authentifiée", { provider, vendor: adapter.vendor });
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const event = adapter.normalizeEvent(payload);
  const admin = createAdminClient();

  // --- Idempotence ---------------------------------------------------------
  const { error: eventError } = await admin.from("payment_events").insert({
    provider,
    event_id: event.eventId,
    event_type: event.type,
    signature_ok: true,
    payload: { ...payload, _vendor: adapter.vendor },
  });

  if (eventError) {
    if (eventError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    return NextResponse.json({ error: "EVENT_STORE_FAILED" }, { status: 500 });
  }

  const markEvent = async (error?: string) => {
    await admin
      .from("payment_events")
      .update({ error: error ?? null, processed_at: new Date().toISOString() })
      .eq("provider", provider)
      .eq("event_id", event.eventId);
  };

  // --- Rapprochement par référence interne ---------------------------------
  const { data: transaction } = await admin
    .from("transactions")
    .select("*")
    .eq("reference", event.reference)
    .maybeSingle();

  if (!transaction) {
    await markEvent("TRANSACTION_NOT_FOUND");
    return NextResponse.json({ received: true, matched: false });
  }

  // --- Confirmation serveur-à-serveur (source de vérité) -------------------
  const confirmation = await adapter.confirm(transaction.reference, event.providerRef);
  if (!confirmation) {
    // Fournisseur injoignable : on ne crédite pas et on demande un rejeu.
    await admin
      .from("payment_events")
      .update({ error: "CONFIRMATION_UNAVAILABLE" })
      .eq("provider", provider)
      .eq("event_id", event.eventId);
    return NextResponse.json({ error: "CONFIRMATION_UNAVAILABLE" }, { status: 502 });
  }

  // La référence confirmée côté fournisseur doit correspondre à la nôtre.
  if (confirmation.reference && confirmation.reference !== transaction.reference) {
    await markEvent("REFERENCE_MISMATCH");
    return NextResponse.json({ error: "REFERENCE_MISMATCH" }, { status: 409 });
  }

  // --- Application du statut confirmé -------------------------------------
  if (confirmation.status === "succeeded") {
    // Le montant confirmé doit correspondre exactement à celui de la base.
    // (Un montant absent = 0 est toléré seulement si la transaction est à 0,
    // ce qui n'arrive jamais pour un paiement réel.)
    if (confirmation.amountXof > 0 && confirmation.amountXof !== transaction.total_xof) {
      await markEvent("AMOUNT_MISMATCH");
      return NextResponse.json({ error: "AMOUNT_MISMATCH" }, { status: 409 });
    }

    if (transaction.status === "paid") {
      await markEvent();
      return NextResponse.json({ received: true, alreadyPaid: true });
    }

    await admin
      .from("transactions")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        provider_ref: confirmation.providerRef || event.providerRef,
      })
      .eq("id", transaction.id);

    if (transaction.plan_id) {
      await admin.rpc("activate_subscription", {
        p_user_id: transaction.user_id,
        p_plan_id: transaction.plan_id,
        p_provider: provider,
        p_provider_ref: confirmation.providerRef || transaction.reference,
      });
    }

    if (transaction.course_id) {
      await admin.from("enrollments").upsert(
        {
          user_id: transaction.user_id,
          course_id: transaction.course_id,
          source: "purchase",
          status: "active",
        },
        { onConflict: "user_id,course_id" },
      );
    }

    if (transaction.promo_code_id) {
      await admin.rpc("increment_promo_redemption", { p_promo_id: transaction.promo_code_id });
    }
  }

  if (confirmation.status === "failed") {
    await admin.from("transactions").update({ status: "failed" }).eq("id", transaction.id);
  }

  if (event.type === "payment.refunded") {
    await admin.from("transactions").update({ status: "refunded" }).eq("id", transaction.id);

    if (transaction.course_id) {
      await admin
        .from("enrollments")
        .update({ status: "cancelled" })
        .eq("user_id", transaction.user_id)
        .eq("course_id", transaction.course_id);
    }
  }

  await markEvent();
  return NextResponse.json({ received: true, status: confirmation.status });
}

/** Certains agrégateurs vérifient l'URL par un GET : on répond 200 sans traiter. */
export const dynamic = "force-dynamic";
