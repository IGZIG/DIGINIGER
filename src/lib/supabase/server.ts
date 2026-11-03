import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

/**
 * Client Supabase côté serveur, lié à la session de l'utilisateur.
 * Les cookies sont rafraîchis par le middleware (voir src/middleware.ts).
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Appelé depuis un Server Component : le middleware s'en charge.
          }
        },
      },
    },
  );
}
