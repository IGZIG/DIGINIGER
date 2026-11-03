import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/** Déconnexion : POST uniquement (jamais un GET, pour éviter le CSRF par lien). */
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
