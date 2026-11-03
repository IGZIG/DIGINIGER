"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/fields";
import { Alert } from "@/components/ui/primitives";
import { createPromoCodeAction } from "@/lib/actions/admin";

/** Création d'un code promotionnel (administration). */
export function PromoCodeForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  return (
    <form
      className="space-y-3"
      action={(formData) => {
        setFeedback(null);
        startTransition(async () => {
          const result = await createPromoCodeAction(formData);
          if (!result.ok) {
            setFeedback({ tone: "error", text: result.message ?? "Création impossible." });
            return;
          }
          setFeedback({ tone: "success", text: "Code promotionnel créé." });
          router.refresh();
        });
      }}
    >
      <p className="text-sm font-medium text-night-700">Créer un code</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="promo-code" required>Code</Label>
          <Input id="promo-code" name="code" placeholder="RENTREE2026" required minLength={3} />
        </div>
        <div>
          <Label htmlFor="promo-kind" required>Type</Label>
          <Select id="promo-kind" name="kind" defaultValue="percent">
            <option value="percent">Pourcentage</option>
            <option value="amount">Montant fixe (FCFA)</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="promo-value" required>Valeur</Label>
          <Input id="promo-value" name="value" type="number" min={1} defaultValue={10} required />
        </div>
        <div>
          <Label htmlFor="promo-max" required>Utilisations max.</Label>
          <Input id="promo-max" name="maxRedemptions" type="number" min={1} defaultValue={100} required />
        </div>
      </div>
      {feedback && <Alert tone={feedback.tone}>{feedback.text}</Alert>}
      <Button type="submit" size="sm" variant="outline" loading={pending}>
        <Plus className="h-4 w-4" aria-hidden />
        Créer le code
      </Button>
    </form>
  );
}
