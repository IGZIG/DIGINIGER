import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { paymentStatus } from "@/lib/payments/provider";

/**
 * GET /api/admin/payments/diagnostic — contrôle réel du fournisseur Mobile Money.
 * ---------------------------------------------------------------------------
 * Réservé aux administrateurs (401 / 403).
 *
 * Ce contrôle ne crée AUCUNE facture et ne déplace AUCUN argent : il envoie une
 * requête authentifiée au fournisseur pour vérifier que les clés sont acceptées,
 * puis interroge une facture inexistante pour confirmer que l'API répond.
 *
 *   - 200 + `reachable: true`  → les clés sont acceptées par le fournisseur ;
 *   - 200 + `reachable: false` → les clés sont refusées ou le fournisseur est
 *     injoignable : le message explique lequel des deux.
 *
 * Aucune clé n'est jamais renvoyée au navigateur.
 */
export async function GET() {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (user.profile?.role !== "admin") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const status = paymentStatus();

  if (!status.mobileMoney) {
    return NextResponse.json({
      configured: false,
      vendor: status.vendor,
      missing: status.missing,
      reachable: false,
      message:
        status.missing.length > 0
          ? `Variables manquantes : ${status.missing.join(", ")}. Aucun paiement ne peut être initié.`
          : "Aucun fournisseur Mobile Money n'est configuré. Aucun paiement ne peut être initié.",
    });
  }

  const notifyUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://diginiger.vercel.app"}/api/payments/webhook?provider=mobile_money`;

  if (status.vendor === "paydunya") {
    const baseUrl =
      process.env.PAYDUNYA_API_URL ??
      (process.env.PAYDUNYA_MODE === "live"
        ? "https://app.paydunya.com/api/v1"
        : "https://app.paydunya.com/sandbox-api/v1");

    const headers = {
      "Content-Type": "application/json",
      "PAYDUNYA-MASTER-KEY": process.env.PAYDUNYA_MASTER_KEY ?? "",
      "PAYDUNYA-PRIVATE-KEY": process.env.PAYDUNYA_PRIVATE_KEY ?? "",
      "PAYDUNYA-TOKEN": process.env.PAYDUNYA_TOKEN ?? "",
    };

    try {
      // Interroge une facture volontairement inexistante.
      // - 200 avec response_code !== "00" → clés acceptées, facture inconnue (attendu)
      // - 401 / 403 / réponse d'authentification → clés refusées
      const response = await fetch(
        `${baseUrl}/checkout-invoice/confirm/00000000-0000-0000-0000-000000000000`,
        { headers, signal: AbortSignal.timeout(15_000) },
      );

      const text = (await response.text()).slice(0, 400);
      let code: string | null = null;
      let message: string | null = null;
      try {
        const payload = JSON.parse(text) as {
          response_code?: string;
          response_text?: string;
          message?: string;
        };
        code = payload.response_code ?? null;
        message = payload.response_text ?? payload.message ?? null;
      } catch {
        /* réponse non JSON : on garde le texte brut tronqué */
      }

      const authRefused =
        response.status === 401 ||
        response.status === 403 ||
        /master.?key|private.?key|token|unauthori[sz]ed|forbidden/i.test(text);

      return NextResponse.json({
        configured: true,
        vendor: "paydunya",
        mode: process.env.PAYDUNYA_MODE ?? "test",
        apiHost: new URL(baseUrl).host,
        notifyUrl,
        httpStatus: response.status,
        providerCode: code,
        providerMessage: message,
        reachable: !authRefused,
        message: authRefused
          ? "Le fournisseur refuse ces clés. Vérifiez la clé principale, la clé privée et le jeton de la boutique (mode test ou live cohérent avec les clés)."
          : `Clés acceptées par PayDunya. Facture témoin inconnue du fournisseur (attendu) : ${message ?? `code ${code ?? "—"}`}.`,
      });
    } catch (error) {
      return NextResponse.json({
        configured: true,
        vendor: "paydunya",
        mode: process.env.PAYDUNYA_MODE ?? "test",
        notifyUrl,
        reachable: false,
        message:
          error instanceof Error && error.name === "TimeoutError"
            ? "PayDunya n'a pas répondu en 15 secondes. Réessayez."
            : "Impossible de joindre PayDunya depuis le serveur. Vérifiez l'adresse d'API.",
      });
    }
  }

  if (status.vendor === "cinetpay") {
    try {
      const response = await fetch("https://api-checkout.cinetpay.com/v2/payment/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apikey: process.env.CINETPAY_API_KEY ?? "",
          site_id: process.env.CINETPAY_SITE_ID ?? "",
          transaction_id: "0000000000",
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        code?: string;
        message?: string;
      };
      const authRefused = response.status === 401 || response.status === 403;
      return NextResponse.json({
        configured: true,
        vendor: "cinetpay",
        notifyUrl,
        httpStatus: response.status,
        providerCode: payload.code ?? null,
        providerMessage: payload.message ?? null,
        reachable: !authRefused,
        message: authRefused
          ? "CinetPay refuse ces clés. Vérifiez la clé d'API et l'identifiant du site."
          : "CinetPay répond ; les clés ont été transmises sans erreur d'authentification.",
      });
    } catch {
      return NextResponse.json({
        configured: true,
        vendor: "cinetpay",
        notifyUrl,
        reachable: false,
        message: "Impossible de joindre CinetPay depuis le serveur.",
      });
    }
  }

  return NextResponse.json({
    configured: true,
    vendor: status.vendor,
    notifyUrl,
    reachable: true,
    message:
      "Fournisseur générique : aucune vérification automatique possible. L'adresse de notification est celle affichée ci-dessus.",
  });
}

export const dynamic = "force-dynamic";
export const maxDuration = 30;
