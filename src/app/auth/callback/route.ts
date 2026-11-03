import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Callback Supabase Auth : échange le code (vérification email, réinitialisation)
 * contre une session, puis redirige vers la destination demandée.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await supabase
          .from("profiles")
          .update({ is_verified: true, last_seen_at: new Date().toISOString() })
          .eq("id", data.user.id);
      }
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}/connexion?erreur=lien-invalide`);
}
