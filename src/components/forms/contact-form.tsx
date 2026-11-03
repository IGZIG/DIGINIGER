"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select, FieldError } from "@/components/ui/fields";
import { Alert } from "@/components/ui/primitives";
import { submitApplicationAction } from "@/lib/actions/account";

/**
 * Formulaire de demande (contact, candidature formateur, entreprise).
 * Écrit réellement dans public.application_requests : les demandes sont
 * visibles dans le tableau de bord administrateur.
 */
export function ContactForm({
  kind = "contact",
  submitLabel = "Envoyer la demande",
  showOrganisation = false,
  showSubject = true,
}: {
  kind?: "contact" | "instructor" | "enterprise";
  submitLabel?: string;
  showOrganisation?: boolean;
  showSubject?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden />
        <h3 className="mt-3 text-lg font-semibold text-emerald-900">Demande envoyée</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-emerald-800">
          Merci ! Votre demande a bien été enregistrée. Notre équipe vous répond sous 48 heures
          ouvrées.
        </p>
        <Button variant="outline" className="mt-5" onClick={() => setDone(false)}>
          Envoyer une autre demande
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      noValidate
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          formData.set("kind", kind);
          const result = await submitApplicationAction(formData);
          if (!result.ok) {
            setError(result.message);
            return;
          }
          setDone(true);
        })
      }
    >
      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="fullName" required>Nom complet</Label>
          <Input id="fullName" name="fullName" autoComplete="name" required maxLength={80} />
        </div>
        <div>
          <Label htmlFor="email" required>Adresse email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="phone">Téléphone (WhatsApp)</Label>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" />
        </div>
        {showOrganisation && (
          <div>
            <Label htmlFor="organisation">Organisation</Label>
            <Input id="organisation" name="organisation" maxLength={120} />
          </div>
        )}
        {!showOrganisation && showSubject && (
          <div>
            <Label htmlFor="subject">Sujet</Label>
            <Select id="subject" name="subject" defaultValue="information">
              <option value="information">Demande d&apos;information</option>
              <option value="formation">Question sur une formation</option>
              <option value="paiement">Paiement ou abonnement</option>
              <option value="partenariat">Partenariat</option>
              <option value="technique">Problème technique</option>
            </Select>
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="message" required>Votre message</Label>
        <Textarea
          id="message"
          name="message"
          required
          minLength={20}
          maxLength={3000}
          placeholder="Décrivez votre demande en quelques lignes…"
        />
      </div>

      {/* Honeypot invisible : un robot le remplit, un humain non. */}
      <div className="hidden" aria-hidden>
        <label htmlFor="website">Ne pas remplir</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <Button type="submit" loading={pending} size="lg" className="w-full sm:w-auto">
        {submitLabel}
      </Button>
      <p className="text-xs text-night-300">
        Vos données sont utilisées uniquement pour traiter votre demande.
      </p>
    </form>
  );
}
