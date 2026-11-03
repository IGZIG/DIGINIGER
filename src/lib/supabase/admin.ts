import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client service_role — NE JAMAIS importer depuis un composant client.
 * Réservé aux routes serveur : webhooks de paiement, tuteur IA, génération
 * de contenu, génération de certificats.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY manquant : opération serveur impossible.");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "x-diginiger-server": "1" } },
  });
}
