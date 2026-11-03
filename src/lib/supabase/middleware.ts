import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

/**
 * Rafraîchit la session Supabase à chaque requête et protège les routes
 * privées. Le contrôle de rôle fin est refait côté serveur dans chaque
 * layout protégé : le middleware n'est qu'une première barrière.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: CookieToSet[]) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPrivate = ["/app", "/admin", "/formateur"].some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
  const isAuthPage = path === "/connexion" || path === "/inscription";

  if (!user && isPrivate) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Contrôle de rôle anticipé sur les espaces réservés : sans cela, la
  // redirection serait émise après le début du streaming et apparaîtrait en
  // 200 + meta-refresh au lieu d'un 307 net.
  if (user && (path.startsWith("/admin") || path.startsWith("/formateur"))) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role ?? "student";
    const needsAdmin = path.startsWith("/admin");
    const allowed = role === "admin" || (!needsAdmin && role === "instructor");

    if (!allowed) {
      const url = request.nextUrl.clone();
      url.pathname = "/app";
      url.search = "?erreur=acces-refuse";
      return NextResponse.redirect(url);
    }
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
