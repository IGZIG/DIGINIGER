import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { ProfileForm } from "@/components/forms/profile-form";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { ShieldCheck, Mail } from "lucide-react";

export const metadata = { title: "Mon profil" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser("/app/profil");
  const profile = user.profile;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-night-100 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{profile?.full_name || "Mon profil"}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-night-400">
              <Mail className="h-3.5 w-3.5" aria-hidden />
              {user.email}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="electric">
              {profile?.role === "admin"
                ? "Administrateur"
                : profile?.role === "instructor"
                  ? "Formateur"
                  : "Apprenant"}
            </Badge>
            {profile?.is_verified ? (
              <Badge tone="green">
                <ShieldCheck className="h-3 w-3" aria-hidden />
                Compte vérifié
              </Badge>
            ) : (
              <Badge tone="gold">Email non vérifié</Badge>
            )}
            {profile && (
              <span className="text-xs text-night-300">
                Membre depuis {formatDate(profile.created_at)}
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-night-100 bg-white p-6">
        <h2 className="text-base font-semibold">Informations personnelles</h2>
        <p className="mt-1 text-sm text-night-400">
          Ces informations figurent sur vos certificats. Utilisez votre nom complet.
        </p>
        <div className="mt-6">
          <ProfileForm profile={profile} email={user.email ?? ""} />
        </div>
      </section>

      <section className="rounded-2xl border border-night-100 bg-white p-6">
        <h2 className="text-base font-semibold">Sécurité</h2>
        <p className="mt-1 text-sm text-night-400">
          Pour changer votre mot de passe, utilisez la procédure de réinitialisation : un lien sécurisé
          vous sera envoyé par email.
        </p>
        <a
          href="/mot-de-passe-oublie"
          className="mt-4 inline-flex rounded-full border border-night-200 px-4 py-2 text-sm font-medium text-night-700 hover:bg-night-50"
        >
          Réinitialiser mon mot de passe
        </a>
      </section>
    </div>
  );
}
