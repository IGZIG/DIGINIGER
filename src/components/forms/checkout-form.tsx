"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Smartphone, CreditCard, ShieldCheck, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/fields";
import { Alert } from "@/components/ui/primitives";
import { formatXof } from "@/lib/utils";
import { checkoutSchema } from "@/lib/validation";

/**
 * Tunnel de paiement.
 * Le montant affiché est indicatif : le serveur recalcule toujours le prix à
 * partir de la base. En cas de fournisseur non configuré, l'API répond 503 et
 * l'interface l'affiche clairement (aucun faux succès).
 */
export function CheckoutForm({
  planId,
  courseId,
  label,
  amountXof,
  paymentsEnabled,
}: {
  planId?: string;
  courseId?: string;
  label: string;
  amountXof: number;
  paymentsEnabled: { mobileMoney: boolean; card: boolean };
}) {
  const [provider, setProvider] = useState<"mobile_money" | "card">(
    paymentsEnabled.mobileMoney ? "mobile_money" : "card",
  );
  const [phone, setPhone] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const anyEnabled = paymentsEnabled.mobileMoney || paymentsEnabled.card;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldError(null);

    const parsed = checkoutSchema.safeParse({
      planId,
      courseId,
      promoCode: promoCode.trim() || undefined,
      provider,
      phone,
    });

    if (!parsed.success) {
      setFieldError(parsed.error.errors[0].message);
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.message ?? "Le paiement n'a pas pu être initié.");
        return;
      }

      // Redirection vers le fournisseur : seul lui peut confirmer le paiement.
      window.location.href = payload.redirectUrl;
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {!anyEnabled && (
        <Alert tone="warning" title="Paiement en ligne non configuré">
          Cette installation n&apos;a pas encore de fournisseur de paiement actif (variables
          <code className="mx-1 rounded bg-white px-1">PAYMENT_*</code> absentes). Aucun débit ne
          sera effectué. Vous pouvez suivre les formations gratuites dès maintenant, ou{" "}
          <Link href="/contact" className="underline">nous contacter</Link> pour un règlement
          manuel.
        </Alert>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-night-600">Moyen de paiement</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            {
              id: "mobile_money" as const,
              title: "Mobile Money",
              subtitle: "Airtel · Orange · Moov",
              icon: Smartphone,
              enabled: paymentsEnabled.mobileMoney,
            },
            {
              id: "card" as const,
              title: "Carte bancaire",
              subtitle: "Visa · Mastercard",
              icon: CreditCard,
              enabled: paymentsEnabled.card,
            },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={!option.enabled}
              onClick={() => setProvider(option.id)}
              aria-pressed={provider === option.id}
              className={
                "flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors " +
                (provider === option.id && option.enabled
                  ? "border-electric-500 bg-electric-50/60"
                  : "border-night-200 hover:border-night-300") +
                (!option.enabled ? " cursor-not-allowed opacity-50" : "")
              }
            >
              <option.icon className="h-5 w-5 shrink-0 text-night-600" aria-hidden />
              <span>
                <span className="block text-sm font-semibold">{option.title}</span>
                <span className="block text-xs text-night-400">
                  {option.enabled ? option.subtitle : "Indisponible"}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {provider === "mobile_money" && (
        <div>
          <Label htmlFor="phone" required>Numéro Mobile Money</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            placeholder="+227 90 00 00 00"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
          <FieldError>{fieldError}</FieldError>
          <p className="mt-1.5 text-xs text-night-300">
            Vous recevrez une demande de confirmation sur votre téléphone.
          </p>
        </div>
      )}

      <div>
        <Label htmlFor="promo">Code promotionnel</Label>
        <Input
          id="promo"
          value={promoCode}
          onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
          placeholder="DIGI10"
          autoComplete="off"
        />
        <p className="mt-1.5 text-xs text-night-300">
          La remise est vérifiée côté serveur, puis appliquée au montant réel.
        </p>
      </div>

      <div className="rounded-2xl bg-mist p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-night-500">{label}</span>
          <span className="font-semibold">{formatXof(amountXof)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-night-200 pt-2 text-sm">
          <span className="font-medium">Total à payer</span>
          <span className="font-display text-lg font-bold">{formatXof(amountXof)}</span>
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-night-400">
          <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          Le montant final (avec remise éventuelle) est recalculé par le serveur avant paiement.
        </p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <Button type="submit" size="lg" className="w-full" loading={pending} disabled={!anyEnabled}>
        Payer {formatXof(amountXof)}
      </Button>

      <p className="flex items-center justify-center gap-1.5 text-xs text-night-400">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        Paiement vérifié côté serveur · Accès ouvert après confirmation
      </p>
    </form>
  );
}
