import "server-only";
import crypto from "node:crypto";

/**
 * Abstraction des fournisseurs de paiement.
 * ---------------------------------------------------------------------------
 * Trois adaptateurs réels sont disponibles :
 *  - `paydunya`     : Mobile Money (Airtel, Orange, Moov…) — Sénégal, Côte d'Ivoire,
 *                     Burkina, Bénin, Togo, Mali… API REST officielle.
 *  - `cinetpay`     : Mobile Money + cartes — API REST `/v2/payment`.
 *  - `card`         : prestataire carte générique (Stripe-like), dans le même
 *                     format de signature que les deux précédents.
 *
 * Règle de conception : AUCUN succès simulé. Si les clés ne sont pas
 * configurées, `isConfigured()` renvoie false et l'API répond 503 avec un
 * message explicite. L'application ne prétend jamais qu'un paiement a réussi.
 *
 * Deux principes de sécurité appliqués à tous les adaptateurs :
 *  1. Le montant qui fait foi est celui enregistré en base avant l'appel
 *     fournisseur. Un écart entre la notification et notre montant → refus.
 *  2. Une notification n'ouvre JAMAIS l'accès à elle seule : elle est
 *     confirmée par un appel serveur-à-serveur au fournisseur (`confirm`).
 *     C'est indispensable chez PayDunya, dont le « hash » d'IPN est un
 *     SHA-512 statique de la clé principale : identique pour toutes les
 *     notifications, il ne couvre ni le montant ni le statut.
 */

export type ProviderName = "mobile_money" | "card";

/** Identifiant du fournisseur concret (variable PAYMENT_PROVIDER). */
export type VendorName = "paydunya" | "cinetpay" | "generic";

export interface PaymentIntent {
  reference: string;
  amountXof: number;
  description: string;
  customerEmail: string;
  customerPhone?: string | null;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}

export interface PaymentInitResult {
  redirectUrl: string;
  providerRef: string;
  instructions?: string;
}

export interface NormalizedEvent {
  eventId: string;
  type: "payment.succeeded" | "payment.failed" | "payment.refunded" | "unknown";
  reference: string;
  providerRef: string;
  amountXof: number;
  /** true si la notification a passé le premier contrôle d'authenticité. */
  trusted: boolean;
  /** Motif de rejet, journalisé mais jamais renvoyé à l'appelant. */
  reason?: string;
  raw: Record<string, unknown>;
}

/** Résultat de la confirmation serveur-à-serveur. */
export interface ConfirmationResult {
  status: "succeeded" | "failed" | "pending";
  amountXof: number;
  reference: string;
  providerRef: string;
}

export interface PaymentAdapter {
  name: ProviderName;
  vendor: VendorName;
  isConfigured(): boolean;
  initiate(intent: PaymentIntent): Promise<PaymentInitResult>;
  /** Vérifie l'authenticité de la notification (signature ou hash). */
  verifySignature(rawBody: string, headers: Headers): boolean;
  normalizeEvent(payload: Record<string, unknown>): NormalizedEvent;
  /**
   * Confirmation serveur-à-serveur : la seule source qui fait foi pour
   * ouvrir un accès. Retourne null si le fournisseur est injoignable.
   */
  confirm(reference: string, providerRef: string): Promise<ConfirmationResult | null>;
}

const TIMESTAMP_TOLERANCE_SECONDS = 300;

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Signature attendue : `t=<unix>,v1=<hmac(sha256, t + "." + body)>`. */
export function computeSignature(secret: string, timestamp: string, rawBody: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
}

export function verifyHmacSignature(
  secret: string,
  rawBody: string,
  header: string | null,
): boolean {
  if (!header) return false;

  const parts = header.split(",").reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split("=");
    if (key && value) acc[key.trim()] = value.trim();
    return acc;
  }, {});

  const timestamp = parts["t"];
  const provided = parts["v1"];
  if (!timestamp || !provided) return false;

  const now = Math.floor(Date.now() / 1000);
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > TIMESTAMP_TOLERANCE_SECONDS) {
    return false;
  }

  return timingSafeEqual(computeSignature(secret, timestamp, rawBody), provided);
}

function statusToType(status: string): NormalizedEvent["type"] {
  const value = status.toLowerCase();
  if (["completed", "complete", "success", "succeeded", "paid", "accepted", "validated"].includes(value)) {
    return "payment.succeeded";
  }
  if (["failed", "error", "cancelled", "canceled", "refused", "rejected"].includes(value)) {
    return "payment.failed";
  }
  if (["refunded", "refund"].includes(value)) return "payment.refunded";
  return "unknown";
}

// ---------------------------------------------------------------------------
// 1. PayDunya — Mobile Money Afrique de l'Ouest
// ---------------------------------------------------------------------------
class PayDunyaAdapter implements PaymentAdapter {
  name: ProviderName = "mobile_money";
  vendor: VendorName = "paydunya";

  private get masterKey() {
    return process.env.PAYDUNYA_MASTER_KEY ?? "";
  }
  private get privateKey() {
    return process.env.PAYDUNYA_PRIVATE_KEY ?? "";
  }
  private get token() {
    return process.env.PAYDUNYA_TOKEN ?? "";
  }
  /**
   * URL d'API : surchargeable par PAYDUNYA_API_URL pour les tests locaux
   * (serveur stub) et les proxys d'entreprise. Par défaut : endpoints officiels.
   */
  private get baseUrl() {
    if (process.env.PAYDUNYA_API_URL) return process.env.PAYDUNYA_API_URL;
    return process.env.PAYDUNYA_MODE === "live"
      ? "https://app.paydunya.com/api/v1"
      : "https://app.paydunya.com/sandbox-api/v1";
  }

  /** URL de la page de paiement hébergée (surchargeable en test). */
  private get checkoutBase() {
    return process.env.PAYDUNYA_CHECKOUT_URL ?? "https://paydunya.com/checkout/invoice";
  }

  isConfigured(): boolean {
    return Boolean(this.masterKey && this.privateKey && this.token);
  }

  private headers() {
    return {
      "Content-Type": "application/json",
      "PAYDUNYA-MASTER-KEY": this.masterKey,
      "PAYDUNYA-PRIVATE-KEY": this.privateKey,
      "PAYDUNYA-TOKEN": this.token,
    };
  }

  async initiate(intent: PaymentIntent): Promise<PaymentInitResult> {
    if (!this.isConfigured()) throw new Error("PAYMENT_NOT_CONFIGURED");

    const response = await fetch(`${this.baseUrl}/checkout-invoice/create`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        invoice: {
          total_amount: intent.amountXof,
          description: intent.description,
        },
        store: {
          name: "DIGINIGER",
          website_url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://diginiger.com",
        },
        // Les custom_data reviennent dans l'IPN : c'est notre seule source de
        // rapprochement (PayDunya ne renvoie pas notre référence d'elle-même).
        custom_data: {
          reference: intent.reference,
          customer_email: intent.customerEmail,
        },
        actions: {
          cancel_url: intent.cancelUrl,
          return_url: intent.returnUrl,
          callback_url: intent.notifyUrl,
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) throw new Error(`PAYMENT_PROVIDER_HTTP_${response.status}`);

    const payload = (await response.json()) as {
      response_code?: string;
      response_text?: string;
      token?: string;
    };

    if (payload.response_code !== "00" || !payload.token) {
      throw new Error(`PAYMENT_PROVIDER_REFUSED_${payload.response_code ?? "UNKNOWN"}`);
    }

    return {
      // PayDunya héberge la page de paiement sur ce format d'URL.
      redirectUrl: `${this.checkoutBase}/${payload.token}`,
      providerRef: payload.token,
      instructions: payload.response_text,
    };
  }

  /**
   * PayDunya n'envoie pas de signature HMAC : l'IPN contient
   * `data.hash = sha512(MASTER_KEY)`, identique à chaque notification et ne
   * couvrant ni le montant ni le statut. On le vérifie comme premier filtre
   * bon marché, puis `confirm()` fait réellement foi.
   */
  verifySignature(rawBody: string, headers: Headers): boolean {
    if (!this.masterKey) return false;
    if (headers.get("x-paydunya-signature")) {
      // Certaines intégrations proxy ajoutent une signature : si elle est
      // présente, elle est vérifiée en priorité.
      return verifyHmacSignature(
        process.env.PAYMENT_WEBHOOK_SECRET ?? this.masterKey,
        rawBody,
        headers.get("x-paydunya-signature"),
      );
    }

    try {
      const payload = JSON.parse(rawBody) as { data?: { hash?: string } };
      const provided = payload.data?.hash;
      if (!provided) return false;
      const expected = crypto.createHash("sha512").update(this.masterKey).digest("hex");
      return timingSafeEqual(expected, provided);
    } catch {
      return false;
    }
  }

  normalizeEvent(payload: Record<string, unknown>): NormalizedEvent {
    const data = (payload.data ?? payload) as Record<string, any>;
    const invoice = (data.invoice ?? {}) as Record<string, any>;
    const status = String(data.status ?? "").toLowerCase();
    const reference = String(data.custom_data?.reference ?? invoice.token ?? "");
    const providerRef = String(invoice.token ?? "");

    return {
      eventId: `paydunya:${providerRef || reference}:${status}`,
      type: statusToType(status),
      reference,
      providerRef,
      amountXof: Number(invoice.total_amount ?? data.total_amount ?? 0),
      trusted: true,
      raw: payload,
    };
  }

  async confirm(_reference: string, providerRef: string): Promise<ConfirmationResult | null> {
    if (!this.isConfigured() || !providerRef) return null;

    try {
      const response = await fetch(
        `${this.baseUrl}/checkout-invoice/confirm/${encodeURIComponent(providerRef)}`,
        { headers: this.headers(), signal: AbortSignal.timeout(15_000) },
      );
      if (!response.ok) return null;

      const payload = (await response.json()) as {
        response_code?: string;
        status?: string;
        invoice?: { total_amount?: number | string; token?: string };
        custom_data?: { reference?: string };
      };

      if (payload.response_code !== "00") return null;

      const status = statusToType(String(payload.status ?? ""));
      return {
        status:
          status === "payment.succeeded"
            ? "succeeded"
            : status === "payment.failed"
              ? "failed"
              : "pending",
        amountXof: Number(payload.invoice?.total_amount ?? 0),
        reference: String(payload.custom_data?.reference ?? ""),
        providerRef: String(payload.invoice?.token ?? providerRef),
      };
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// 2. CinetPay — Mobile Money + cartes
// ---------------------------------------------------------------------------
class CinetPayAdapter implements PaymentAdapter {
  name: ProviderName = "mobile_money";
  vendor: VendorName = "cinetpay";

  private get apiKey() {
    return process.env.CINETPAY_API_KEY ?? "";
  }
  private get siteId() {
    return process.env.CINETPAY_SITE_ID ?? "";
  }
  private get secretKey() {
    return process.env.CINETPAY_SECRET_KEY ?? "";
  }
  private get notifySecret() {
    return process.env.CINETPAY_NOTIFY_SECRET ?? process.env.PAYMENT_WEBHOOK_SECRET ?? "";
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.siteId);
  }

  async initiate(intent: PaymentIntent): Promise<PaymentInitResult> {
    if (!this.isConfigured()) throw new Error("PAYMENT_NOT_CONFIGURED");

    const apiUrl = process.env.CINETPAY_API_URL ?? "https://api-checkout.cinetpay.com";
    const response = await fetch(`${apiUrl}/v2/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: this.apiKey,
        site_id: this.siteId,
        // CinetPay exige un transaction_id sans caractère spécial.
        transaction_id: intent.reference.replace(/[^A-Za-z0-9]/g, ""),
        amount: intent.amountXof,
        currency: "XOF",
        description: intent.description.replace(/[#/$,&_]/g, " ").slice(0, 250),
        customer_email: intent.customerEmail,
        customer_phone_number: intent.customerPhone ?? undefined,
        notify_url: intent.notifyUrl,
        return_url: intent.returnUrl,
        channels: "ALL",
        metadata: intent.reference,
        lang: "fr",
        invoice_data: { reference: intent.reference },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) throw new Error(`PAYMENT_PROVIDER_HTTP_${response.status}`);

    const payload = (await response.json()) as {
      code?: string;
      message?: string;
      data?: { payment_url?: string; payment_token?: string };
    };

    if (payload.code !== "201" || !payload.data?.payment_url) {
      throw new Error(`PAYMENT_PROVIDER_REFUSED_${payload.code ?? "UNKNOWN"}`);
    }

    return {
      redirectUrl: payload.data.payment_url,
      providerRef: payload.data.payment_token ?? intent.reference,
      instructions: payload.message,
    };
  }

  /**
   * CinetPay peut envoyer un en-tête `x-token` (HMAC-SHA256) si la Secret Key
   * est configurée ; sinon la notification est acceptée au premier filtre puis
   * confirmée obligatoirement par `confirm()`.
   */
  verifySignature(rawBody: string, headers: Headers): boolean {
    const provided =
      headers.get("x-token") ?? headers.get("x-cinetpay-signature") ?? headers.get("x-signature");

    if (!this.notifySecret) {
      // Pas de secret de notification : on laisse passer le premier filtre,
      // la confirmation serveur-à-serveur reste obligatoire.
      return true;
    }
    if (!provided) return false;
    if (provided.includes("t=")) {
      return verifyHmacSignature(this.notifySecret, rawBody, provided);
    }
    const expected = crypto.createHmac("sha256", this.notifySecret).update(rawBody).digest("hex");
    return timingSafeEqual(expected, provided);
  }

  normalizeEvent(payload: Record<string, unknown>): NormalizedEvent {
    const data = (payload.cpm_data ?? payload) as Record<string, any>;
    const status = String(data.cpm_result ?? payload.cpm_result ?? "").toLowerCase();
    const reference = String(data.cpm_custom ?? payload.cpm_custom ?? data.metadata ?? "");
    const providerRef = String(data.cpm_trans_id ?? payload.cpm_trans_id ?? "");

    return {
      eventId: `cinetpay:${providerRef || reference}:${status}`,
      type: statusToType(status),
      reference,
      providerRef,
      amountXof: Number(data.cpm_amount ?? payload.cpm_amount ?? 0),
      trusted: true,
      raw: payload,
    };
  }

  async confirm(_reference: string, providerRef: string): Promise<ConfirmationResult | null> {
    if (!this.isConfigured() || !providerRef) return null;

    try {
      const apiUrl = process.env.CINETPAY_API_URL ?? "https://api-checkout.cinetpay.com";
      const response = await fetch(`${apiUrl}/v2/payment/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apikey: this.apiKey,
          site_id: this.siteId,
          transaction_id: providerRef,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) return null;

      const payload = (await response.json()) as {
        code?: string;
        data?: {
          cpm_result?: string;
          cpm_amount?: number | string;
          cpm_trans_id?: string;
          cpm_custom?: string;
          cpm_trans_status?: string;
        };
      };

      if (payload.code !== "00" || !payload.data) return null;

      const rawStatus = String(payload.data.cpm_result ?? "").toLowerCase();
      const transStatus = String(payload.data.cpm_trans_status ?? "").toUpperCase();

      return {
        status:
          rawStatus === "00" && (transStatus === "ACCEPTED" || transStatus === "VALIDATED")
            ? "succeeded"
            : rawStatus === "00"
              ? "pending"
              : "failed",
        amountXof: Number(payload.data.cpm_amount ?? 0),
        reference: String(payload.data.cpm_custom ?? ""),
        providerRef: String(payload.data.cpm_trans_id ?? providerRef),
      };
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Adaptateur générique (agrégateur maison, signature HMAC)
// ---------------------------------------------------------------------------
class GenericMobileMoneyAdapter implements PaymentAdapter {
  name: ProviderName = "mobile_money";
  vendor: VendorName = "generic";

  isConfigured(): boolean {
    return Boolean(
      process.env.PAYMENT_API_URL &&
        process.env.PAYMENT_API_KEY &&
        process.env.PAYMENT_WEBHOOK_SECRET,
    );
  }

  async initiate(intent: PaymentIntent): Promise<PaymentInitResult> {
    if (!this.isConfigured()) throw new Error("PAYMENT_NOT_CONFIGURED");

    const response = await fetch(`${process.env.PAYMENT_API_URL}/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.PAYMENT_API_KEY}`,
        "X-Api-Secret": process.env.PAYMENT_API_SECRET ?? "",
      },
      body: JSON.stringify({
        amount: intent.amountXof,
        currency: "XOF",
        reference: intent.reference,
        description: intent.description,
        customer: { email: intent.customerEmail, phone: intent.customerPhone },
        channels: ["airtel_money", "orange_money", "moov_money"],
        return_url: intent.returnUrl,
        cancel_url: intent.cancelUrl,
        notify_url: intent.notifyUrl,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) throw new Error(`PAYMENT_PROVIDER_HTTP_${response.status}`);

    const payload = (await response.json()) as {
      payment_url?: string;
      token?: string;
      reference?: string;
      instructions?: string;
    };

    if (!payload.payment_url) throw new Error("PAYMENT_PROVIDER_INVALID_RESPONSE");

    return {
      redirectUrl: payload.payment_url,
      providerRef: payload.token ?? payload.reference ?? intent.reference,
      instructions: payload.instructions,
    };
  }

  verifySignature(rawBody: string, headers: Headers): boolean {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!secret) return false;
    const header = headers.get("x-signature") ?? headers.get("x-webhook-signature");
    return verifyHmacSignature(secret, rawBody, header);
  }

  normalizeEvent(raw: Record<string, unknown>): NormalizedEvent {
    const payload = raw as Record<string, any>;
    const status = String(payload.status ?? payload.event ?? "").toLowerCase();

    return {
      eventId: String(payload.event_id ?? payload.id ?? `${payload.reference}-${status}`),
      type: statusToType(status),
      reference: String(payload.reference ?? payload.invoice?.token ?? ""),
      providerRef: String(payload.token ?? payload.transaction_id ?? ""),
      amountXof: Number(payload.amount ?? 0),
      trusted: true,
      raw,
    };
  }

  async confirm(_reference: string, providerRef: string): Promise<ConfirmationResult | null> {
    const configured = process.env.PAYMENT_API_URL && process.env.PAYMENT_API_KEY;
    if (!configured || !providerRef) return null;

    try {
      const response = await fetch(
        `${process.env.PAYMENT_API_URL}/transactions/${encodeURIComponent(providerRef)}`,
        {
          headers: { Authorization: `Bearer ${process.env.PAYMENT_API_KEY}` },
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (!response.ok) return null;

      const payload = (await response.json()) as {
        status?: string;
        amount?: number | string;
        reference?: string;
        id?: string;
      };
      const type = statusToType(String(payload.status ?? ""));

      return {
        status:
          type === "payment.succeeded" ? "succeeded" : type === "payment.failed" ? "failed" : "pending",
        amountXof: Number(payload.amount ?? 0),
        reference: String(payload.reference ?? ""),
        providerRef: String(payload.id ?? providerRef),
      };
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Carte bancaire (prestataire générique, signature HMAC)
// ---------------------------------------------------------------------------
class CardAdapter implements PaymentAdapter {
  name: ProviderName = "card";
  vendor: VendorName = "generic";

  isConfigured(): boolean {
    return Boolean(process.env.CARD_API_URL && process.env.CARD_API_KEY);
  }

  async initiate(intent: PaymentIntent): Promise<PaymentInitResult> {
    if (!this.isConfigured()) throw new Error("PAYMENT_NOT_CONFIGURED");

    const response = await fetch(`${process.env.CARD_API_URL}/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CARD_API_KEY}`,
      },
      body: JSON.stringify({
        amount: intent.amountXof,
        currency: "XOF",
        reference: intent.reference,
        success_url: intent.returnUrl,
        cancel_url: intent.cancelUrl,
        webhook_url: intent.notifyUrl,
        customer_email: intent.customerEmail,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) throw new Error(`PAYMENT_PROVIDER_HTTP_${response.status}`);

    const payload = (await response.json()) as { url?: string; id?: string; token?: string };
    if (!payload.url) throw new Error("PAYMENT_PROVIDER_INVALID_RESPONSE");

    return { redirectUrl: payload.url, providerRef: payload.id ?? intent.reference };
  }

  verifySignature(rawBody: string, headers: Headers): boolean {
    const secret = process.env.CARD_WEBHOOK_SECRET;
    if (!secret) return false;
    const header = headers.get("x-signature") ?? headers.get("x-webhook-signature");
    return verifyHmacSignature(secret, rawBody, header);
  }

  normalizeEvent(raw: Record<string, unknown>): NormalizedEvent {
    const payload = raw as Record<string, any>;
    return {
      eventId: String(payload.id ?? payload.reference ?? ""),
      type: statusToType(String(payload.status ?? "")),
      reference: String(payload.reference ?? ""),
      providerRef: String(payload.id ?? ""),
      amountXof: Number(payload.amount ?? 0),
      trusted: true,
      raw,
    };
  }

  async confirm(_reference: string, providerRef: string): Promise<ConfirmationResult | null> {
    if (!this.isConfigured() || !providerRef) return null;

    try {
      const response = await fetch(
        `${process.env.CARD_API_URL}/sessions/${encodeURIComponent(providerRef)}`,
        {
          headers: { Authorization: `Bearer ${process.env.CARD_API_KEY}` },
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (!response.ok) return null;

      const payload = (await response.json()) as {
        status?: string;
        amount?: number | string;
        reference?: string;
        id?: string;
      };
      const type = statusToType(String(payload.status ?? ""));

      return {
        status:
          type === "payment.succeeded" ? "succeeded" : type === "payment.failed" ? "failed" : "pending",
        amountXof: Number(payload.amount ?? 0),
        reference: String(payload.reference ?? ""),
        providerRef: String(payload.id ?? providerRef),
      };
    } catch {
      return null;
    }
  }
}

/** Fournisseur Mobile Money effectivement sélectionné par la configuration. */
export function mobileMoneyVendor(): VendorName {
  const declared = (process.env.PAYMENT_PROVIDER ?? "").toLowerCase();
  if (declared === "paydunya" || declared === "cinetpay" || declared === "generic") {
    return declared;
  }
  // Détection automatique : la présence des clés fait foi.
  if (process.env.PAYDUNYA_MASTER_KEY && process.env.PAYDUNYA_PRIVATE_KEY) return "paydunya";
  if (process.env.CINETPAY_API_KEY && process.env.CINETPAY_SITE_ID) return "cinetpay";
  if (process.env.PAYMENT_API_URL && process.env.PAYMENT_API_KEY) return "generic";
  return "generic";
}

export function getPaymentAdapter(provider: ProviderName): PaymentAdapter {
  if (provider === "card") return new CardAdapter();
  switch (mobileMoneyVendor()) {
    case "paydunya":
      return new PayDunyaAdapter();
    case "cinetpay":
      return new CinetPayAdapter();
    default:
      return new GenericMobileMoneyAdapter();
  }
}

/** État détaillé, affiché dans /admin/paiements et /admin/parametres. */
export function paymentStatus() {
  const vendor = mobileMoneyVendor();
  const adapter = getPaymentAdapter("mobile_money");
  const missing: string[] = [];

  if (vendor === "paydunya") {
    for (const key of ["PAYDUNYA_MASTER_KEY", "PAYDUNYA_PRIVATE_KEY", "PAYDUNYA_TOKEN"]) {
      if (!process.env[key]) missing.push(key);
    }
  } else if (vendor === "cinetpay") {
    for (const key of ["CINETPAY_API_KEY", "CINETPAY_SITE_ID"]) {
      if (!process.env[key]) missing.push(key);
    }
  } else {
    for (const key of ["PAYMENT_API_URL", "PAYMENT_API_KEY", "PAYMENT_WEBHOOK_SECRET"]) {
      if (!process.env[key]) missing.push(key);
    }
  }

  return {
    mobileMoney: adapter.isConfigured(),
    card: new CardAdapter().isConfigured(),
    vendor,
    mode:
      vendor === "paydunya"
        ? (process.env.PAYDUNYA_MODE ?? "test")
        : (process.env.PAYMENT_MODE ?? "test"),
    missing,
    /** Confirmation serveur-à-serveur : obligatoire pour ouvrir un accès. */
    requiresConfirmation: vendor === "paydunya" || vendor === "cinetpay",
  };
}
