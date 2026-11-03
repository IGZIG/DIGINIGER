"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Client Supabase côté navigateur.
 * Utilise uniquement la clé publishable : toutes les autorisations sont
 * appliquées par les politiques RLS de PostgreSQL.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
