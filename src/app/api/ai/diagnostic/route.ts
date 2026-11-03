import { NextResponse } from "next/server";
import { aiConfigReport, probeAi } from "@/lib/ai/tutor";
import { getApiUser } from "@/lib/auth";

/**
 * GET /api/ai/diagnostic — contrôle « à froid » réservé à l'administration.
 * Effectue un vrai appel au fournisseur (complétion courte + embedding) et
 * vérifie la dimension des vecteurs. Ne renvoie jamais la clé API.
 *
 * `?probe=0` se contente de la configuration déclarée (aucun appel réseau).
 */
export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (user.profile?.role !== "admin") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const report = aiConfigReport();
  const shouldProbe = new URL(request.url).searchParams.get("probe") !== "0";

  if (!shouldProbe || !report.configured) {
    return NextResponse.json({ ...report, probe: null });
  }

  const probe = await probeAi();
  return NextResponse.json({ ...report, probe });
}
