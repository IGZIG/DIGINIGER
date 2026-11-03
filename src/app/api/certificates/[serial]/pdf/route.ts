import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/auth";
import { buildCertificatePdf } from "@/lib/certificates/pdf";

/**
 * GET /api/certificates/:serial/pdf
 * ---------------------------------------------------------------------------
 * Téléchargement du certificat PDF. Réservé :
 *  - au titulaire du certificat,
 *  - ou à un administrateur.
 * Un certificat révoqué n'est plus téléchargeable.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ serial: string }> },
) {
  const { serial } = await params;

  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  if (!/^DIGI-\d{4}-[A-Z0-9]{7}$/.test(serial)) {
    return NextResponse.json({ error: "INVALID_SERIAL" }, { status: 400 });
  }

  // service_role : nécessaire pour reconstruire le PDF même si la RLS
  // n'autorise pas la lecture de la colonne verification_hash au client.
  const admin = createAdminClient();
  const { data: certificate } = await admin
    .from("certificates")
    .select("*")
    .eq("serial", serial)
    .maybeSingle();

  if (!certificate) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const isOwner = certificate.user_id === user.authId;
  const isAdmin = user.profile?.role === "admin";

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  if (certificate.revoked_at) {
    return NextResponse.json({ error: "CERTIFICATE_REVOKED" }, { status: 410 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const pdfBytes = await buildCertificatePdf({
    serial: certificate.serial,
    studentName: certificate.student_name,
    courseTitle: certificate.course_title,
    issuedAt: new Date(certificate.issued_at),
    score: certificate.score,
    verificationUrl: `${siteUrl}/verifier-certificat?numero=${certificate.serial}`,
  });

  await admin.from("audit_logs").insert({
    actor_id: user.authId,
    action: "certificate.downloaded",
    entity: "certificates",
    entity_id: certificate.id,
    metadata: { serial: certificate.serial },
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="certificat-${certificate.serial}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
