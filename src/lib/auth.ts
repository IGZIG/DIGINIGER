import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types/database";

/**
 * Utilisateur courant, mémorisé pour la durée d'une requête.
 * Le profil est la source de vérité du rôle (jamais un cookie, jamais un
 * paramètre d'URL).
 */
export const getCurrentUser = cache(async (): Promise<{
  authId: string;
  email: string | null;
  profile: Profile | null;
} | null> => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { authId: user.id, email: user.email ?? null, profile: profile as Profile | null };
});

/** Redirige vers /connexion si non authentifié. */
export async function requireUser(nextPath = "/app") {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(nextPath)}`);
  return user;
}

/**
 * Contrôle d'accès basé sur le rôle.
 * - Non connecté  → /connexion
 * - Rôle insuffisant → /app (espace apprenant) avec message
 * Le rôle admin inclut les droits formateur.
 */
export async function requireRole(roles: UserRole[], nextPath = "/app") {
  const user = await requireUser(nextPath);
  const role = user.profile?.role ?? "student";
  // L'administration dispose de tous les droits (elle doit pouvoir relire et
  // corriger le contenu d'un formateur).
  const allowed = roles.includes(role) || role === "admin";

  if (!allowed) {
    redirect("/app?erreur=acces-refuse");
  }
  return user;
}

/** Vérification non redirigeante, pour l'affichage conditionnel. */
export async function hasRole(roles: UserRole[]): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const role = user.profile?.role ?? "student";
  return roles.includes(role) || role === "admin";
}

/**
 * Garde de route API : renvoie l'utilisateur ou null.
 * Les routes API répondent 401/403 elles-mêmes (pas de redirect HTML).
 */
export async function getApiUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { authId: user.id, email: user.email ?? null, profile: profile as Profile | null, supabase };
}
