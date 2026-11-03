"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { updatePasswordSchema } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError, PasswordStrength } from "@/components/ui/fields";
import { Alert } from "@/components/ui/primitives";

/** Définition d'un nouveau mot de passe après clic sur le lien de réinitialisation. */
export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setGlobalError(null);

    const parsed = updatePasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.errors) {
        fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setGlobalError(
        error.message.includes("session")
          ? "Lien expiré. Demandez un nouvel email de réinitialisation."
          : "Impossible de mettre à jour le mot de passe.",
      );
      return;
    }

    router.push("/app");
    router.refresh();
  }

  return (
    <div className="w-full max-w-md">
      <h1 className="text-2xl font-semibold">Nouveau mot de passe</h1>
      <p className="mt-1.5 text-sm text-night-400">
        Choisissez un mot de passe d&apos;au moins 8 caractères, avec lettres et chiffres.
      </p>

      <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
        {globalError && <Alert tone="error">{globalError}</Alert>}
        <div>
          <Label htmlFor="password" required>
            Nouveau mot de passe
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            invalid={Boolean(errors.password)}
          />
          <FieldError>{errors.password}</FieldError>
          <PasswordStrength password={password} />
        </div>
        <div>
          <Label htmlFor="confirmPassword" required>
            Confirmer le mot de passe
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            invalid={Boolean(errors.confirmPassword)}
          />
          <FieldError>{errors.confirmPassword}</FieldError>
        </div>
        <Button type="submit" loading={loading} size="lg" className="w-full">
          Mettre à jour le mot de passe
        </Button>
      </form>
    </div>
  );
}
