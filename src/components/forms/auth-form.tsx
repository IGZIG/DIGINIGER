"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Mail, Lock, User, Phone, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError, Checkbox, PasswordStrength } from "@/components/ui/fields";
import { Alert } from "@/components/ui/primitives";
import { loginSchema, signupSchema } from "@/lib/validation";

type Mode = "login" | "signup" | "forgot";

const ERRORS: Record<string, string> = {
  "lien-invalide": "Le lien est invalide ou expiré. Demandez un nouvel email.",
  "session-expiree": "Votre session a expiré. Reconnectez-vous.",
  "acces-refuse": "Vous n'avez pas les droits nécessaires pour cette page.",
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get("next") ?? "/app";
  const planCode = params.get("plan");

  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(
    ERRORS[params.get("erreur") ?? ""] ?? null,
  );
  const [success, setSuccess] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setGlobalError(null);
    setSuccess(null);
    setErrors({});

    // --- Validation côté client (confort) : le serveur revalide toujours ---
    if (mode === "signup") {
      const parsed = signupSchema.safeParse({
        fullName,
        email,
        phone,
        password,
        confirmPassword,
        locale: "fr",
        acceptTerms,
      });
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.errors) {
          const key = String(issue.path[0] ?? "form");
          if (!fieldErrors[key]) fieldErrors[key] = issue.message;
        }
        setErrors(fieldErrors);
        return;
      }
    } else if (mode === "login") {
      const parsed = loginSchema.safeParse({ email, password });
      if (!parsed.success) {
        setErrors({ [String(parsed.error.errors[0].path[0])]: parsed.error.errors[0].message });
        return;
      }
    } else if (!email.includes("@")) {
      setErrors({ email: "Adresse email invalide" });
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              phone: phone.trim() || null,
              locale: "fr",
              plan_code: planCode,
            },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
          },
        });

        if (error) {
          setGlobalError(
            error.message.includes("already registered")
              ? "Un compte existe déjà avec cette adresse email."
              : "Inscription impossible pour le moment. Réessayez dans quelques instants.",
          );
          return;
        }

        // Session immédiate si la confirmation email est désactivée côté Supabase.
        if (data.session) {
          router.push(nextPath);
          router.refresh();
          return;
        }

        setSuccess(
          "Compte créé. Vérifiez votre boîte email pour activer votre compte, puis connectez-vous.",
        );
        return;
      }

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          setGlobalError("Email ou mot de passe incorrect.");
          return;
        }
        router.push(nextPath.startsWith("/") ? nextPath : "/app");
        router.refresh();
        return;
      }

      // Mot de passe oublié
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reinitialiser-mot-de-passe`,
      });
      if (error) {
        setGlobalError("Envoi impossible. Vérifiez l'adresse et réessayez.");
        return;
      }
      // Réponse identique que l'adresse existe ou non (anti-énumération).
      setSuccess(
        "Si un compte existe avec cette adresse, un email de réinitialisation vient d'être envoyé.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <h1 className="text-2xl font-semibold">
        {mode === "login" && "Connexion"}
        {mode === "signup" && "Créer votre compte"}
        {mode === "forgot" && "Mot de passe oublié"}
      </h1>
      <p className="mt-1.5 text-sm text-night-400">
        {mode === "login" && "Accédez à votre espace d'apprentissage DIGINIGER."}
        {mode === "signup" && "Commencez gratuitement. Aucune carte bancaire requise."}
        {mode === "forgot" && "Entrez votre email : nous vous envoyons un lien de réinitialisation."}
      </p>

      <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
        {globalError && <Alert tone="error">{globalError}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}

        {mode === "signup" && (
          <div>
            <Label htmlFor="fullName" required>
              Nom complet
            </Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-night-300" aria-hidden />
              <Input
                id="fullName"
                name="fullName"
                autoComplete="name"
                className="pl-10"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                invalid={Boolean(errors.fullName)}
                placeholder="Aminata Boubacar"
              />
            </div>
            <FieldError>{errors.fullName}</FieldError>
          </div>
        )}

        <div>
          <Label htmlFor="email" required>
            Adresse email
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-night-300" aria-hidden />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              className="pl-10"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              invalid={Boolean(errors.email)}
              placeholder="vous@exemple.com"
            />
          </div>
          <FieldError>{errors.email}</FieldError>
        </div>

        {mode === "signup" && (
          <div>
            <Label htmlFor="phone">Téléphone (WhatsApp)</Label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-night-300" aria-hidden />
              <Input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                className="pl-10"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                invalid={Boolean(errors.phone)}
                placeholder="+227 90 00 00 00"
              />
            </div>
            <FieldError>{errors.phone}</FieldError>
          </div>
        )}

        {mode !== "forgot" && (
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password" required>
                Mot de passe
              </Label>
              {mode === "login" && (
                <Link href="/mot-de-passe-oublie" className="mb-1.5 text-xs font-medium text-electric-600 hover:underline">
                  Mot de passe oublié ?
                </Link>
              )}
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-night-300" aria-hidden />
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="pl-10"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                invalid={Boolean(errors.password)}
                placeholder="••••••••"
              />
            </div>
            <FieldError>{errors.password}</FieldError>
            {mode === "signup" && <PasswordStrength password={password} />}
          </div>
        )}

        {mode === "signup" && (
          <>
            <div>
              <Label htmlFor="confirmPassword" required>
                Confirmer le mot de passe
              </Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                invalid={Boolean(errors.confirmPassword)}
                placeholder="••••••••"
              />
              <FieldError>{errors.confirmPassword}</FieldError>
            </div>
            <Checkbox
              id="terms"
              checked={acceptTerms}
              onChange={setAcceptTerms}
              error={errors.acceptTerms}
              label={
                <>
                  J&apos;accepte les{" "}
                  <Link href="/conditions-utilisation" className="text-electric-600 hover:underline">
                    conditions d&apos;utilisation
                  </Link>{" "}
                  et la{" "}
                  <Link href="/confidentialite" className="text-electric-600 hover:underline">
                    politique de confidentialité
                  </Link>
                  .
                </>
              }
            />
          </>
        )}

        <Button type="submit" loading={loading} className="w-full" size="lg">
          {mode === "login" && "Se connecter"}
          {mode === "signup" && "Créer mon compte gratuit"}
          {mode === "forgot" && "Envoyer le lien"}
          {!loading && <ArrowRight className="h-4 w-4" aria-hidden />}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-night-400">
        {mode === "login" ? (
          <>
            Pas encore de compte ?{" "}
            <Link href="/inscription" className="font-semibold text-electric-600 hover:underline">
              Créer un compte
            </Link>
          </>
        ) : (
          <>
            Vous avez déjà un compte ?{" "}
            <Link href="/connexion" className="font-semibold text-electric-600 hover:underline">
              Se connecter
            </Link>
          </>
        )}
      </p>

      <p className="mt-6 rounded-xl bg-mist px-4 py-3 text-center text-xs leading-relaxed text-night-400">
        Vos identifiants sont gérés par Supabase Auth (hachage côté serveur). DIGINIGER ne stocke
        jamais votre mot de passe en clair.
      </p>
    </div>
  );
}
