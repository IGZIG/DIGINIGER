"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { contactSchema, profileSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/actions/learning";

/** Mise à jour du profil de l'utilisateur connecté (RLS : sa propre ligne). */
export async function updateProfileAction(
  formData: FormData,
): Promise<ActionResult<{ updated: true }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, code: "AUTH_REQUIRED", message: "Veuillez vous connecter." };

  const parsed = profileSchema.safeParse({
    fullName: String(formData.get("fullName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    city: String(formData.get("city") ?? ""),
    country: String(formData.get("country") ?? "NE"),
    bio: String(formData.get("bio") ?? ""),
    locale: String(formData.get("locale") ?? "fr"),
  });

  if (!parsed.success) {
    return { ok: false, code: "INVALID", message: parsed.error.errors[0].message };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone || null,
      city: parsed.data.city || null,
      country: parsed.data.country || "NE",
      bio: parsed.data.bio || null,
      locale: parsed.data.locale,
    })
    .eq("id", user.authId);

  if (error) {
    return { ok: false, code: "DB_ERROR", message: "Enregistrement impossible." };
  }

  revalidatePath("/app/profil");
  return { ok: true, data: { updated: true } };
}

/**
 * Demandes entrantes (contact, candidature formateur, entreprise).
 * Table protégée : insertion publique autorisée, lecture réservée aux admins.
 */
export async function submitApplicationAction(
  formData: FormData,
): Promise<ActionResult<{ received: true }>> {
  const user = await getCurrentUser();

  const parsed = contactSchema.safeParse({
    kind: String(formData.get("kind") ?? "contact"),
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    organisation: String(formData.get("organisation") ?? ""),
    subject: String(formData.get("subject") ?? ""),
    message: String(formData.get("message") ?? ""),
    website: String(formData.get("website") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false, code: "INVALID", message: parsed.error.errors[0].message };
  }

  // Honeypot : un robot remplit le champ caché.
  if (parsed.data.website) {
    return { ok: true, data: { received: true } };
  }

  const supabase = await createServerSupabase();

  // Limitation simple : 5 demandes par email et par heure.
  const { count } = await supabase
    .from("application_requests")
    .select("id", { count: "exact", head: true })
    .eq("email", parsed.data.email)
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

  if ((count ?? 0) >= 5) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "Trop de demandes envoyées. Réessayez dans une heure.",
    };
  }

  const { error } = await supabase.from("application_requests").insert({
    kind: parsed.data.kind,
    user_id: user?.authId ?? null,
    full_name: parsed.data.fullName,
    email: parsed.data.email,
    phone: parsed.data.phone || null,
    organisation: parsed.data.organisation || null,
    subject: parsed.data.subject || null,
    payload: { message: parsed.data.message },
  });

  if (error) {
    return { ok: false, code: "DB_ERROR", message: "Envoi impossible. Réessayez." };
  }

  return { ok: true, data: { received: true } };
}
