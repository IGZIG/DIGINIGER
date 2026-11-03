"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/fields";
import { Alert } from "@/components/ui/primitives";
import { updateProfileAction } from "@/lib/actions/account";
import type { Profile } from "@/types/database";

export function ProfileForm({ profile, email }: { profile: Profile | null; email: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  return (
    <form
      className="space-y-4"
      action={(formData) =>
        startTransition(async () => {
          setMessage(null);
          const result = await updateProfileAction(formData);
          if (!result.ok) {
            setMessage({ tone: "error", text: result.message });
            return;
          }
          setMessage({ tone: "success", text: "Profil mis à jour." });
          router.refresh();
        })
      }
    >
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="fullName" required>Nom complet</Label>
          <Input id="fullName" name="fullName" defaultValue={profile?.full_name ?? ""} required />
        </div>
        <div>
          <Label htmlFor="email">Adresse email</Label>
          <Input id="email" value={email} disabled readOnly />
          <p className="mt-1.5 text-xs text-night-300">
            L&apos;email se modifie depuis les paramètres de votre compte Supabase.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="phone">Téléphone</Label>
          <Input id="phone" name="phone" defaultValue={profile?.phone ?? ""} />
        </div>
        <div>
          <Label htmlFor="city">Ville</Label>
          <Input id="city" name="city" defaultValue={profile?.city ?? ""} placeholder="Niamey" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="country">Pays</Label>
          <Select id="country" name="country" defaultValue={profile?.country ?? "NE"}>
            <option value="NE">Niger</option>
            <option value="ML">Mali</option>
            <option value="BF">Burkina Faso</option>
            <option value="SN">Sénégal</option>
            <option value="CI">Côte d&apos;Ivoire</option>
            <option value="BJ">Bénin</option>
            <option value="TG">Togo</option>
            <option value="NG">Nigeria</option>
            <option value="XX">Autre</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="locale">Langue de l&apos;interface</Label>
          <Select id="locale" name="locale" defaultValue={profile?.locale ?? "fr"}>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="bio">Présentation</Label>
        <Textarea
          id="bio"
          name="bio"
          defaultValue={profile?.bio ?? ""}
          maxLength={600}
          placeholder="Quelques lignes sur votre parcours et vos objectifs…"
        />
      </div>

      <Button type="submit" loading={pending}>
        Enregistrer les modifications
      </Button>
    </form>
  );
}
