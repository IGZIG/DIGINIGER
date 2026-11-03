import type { Metadata } from "next";
import Link from "next/link";
import { Award, ExternalLink } from "lucide-react";
import { EmptyState } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { RevokeCertificateButton } from "@/components/dashboard/admin-actions";
import { requireRole } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Certificats (admin)" };
export const dynamic = "force-dynamic";

export default async function AdminCertificatesPage() {
  await requireRole(["admin"], "/admin/certificats");
  const supabase = await createServerSupabase();

  const { data: certificates } = await supabase
    .from("certificates")
    .select("*")
    .order("issued_at", { ascending: false })
    .limit(100);

  const rows = certificates ?? [];
  const active = rows.filter((row) => !row.revoked_at);
  const revoked = rows.filter((row) => row.revoked_at);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Certificats ({rows.length})</h2>
        <p className="text-sm text-night-400">
          Chaque certificat est vérifiable publiquement par son numéro de série et son empreinte
          cryptographique. La révocation est immédiate sur la page de vérification.
        </p>
      </div>

      <div className="flex gap-3">
        <Badge tone="green">{active.length} valide(s)</Badge>
        <Badge tone="red">{revoked.length} révoqué(s)</Badge>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Award className="h-5 w-5" />}
          title="Aucun certificat"
          description="Les certificats sont délivrés après réussite de l'examen final d'une formation terminée."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-night-100 bg-white">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-mist text-left text-xs uppercase tracking-wider text-night-400">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Série</th>
                <th scope="col" className="px-4 py-3 font-medium">Apprenant</th>
                <th scope="col" className="px-4 py-3 font-medium">Formation</th>
                <th scope="col" className="px-4 py-3 font-medium">Délivré le</th>
                <th scope="col" className="px-4 py-3 font-medium">Statut</th>
                <th scope="col" className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-night-100">
              {rows.map((certificate) => (
                <tr key={certificate.id}>
                  <td className="px-4 py-3 font-mono text-xs">{certificate.serial}</td>
                  <td className="px-4 py-3">{certificate.student_name}</td>
                  <td className="px-4 py-3 text-night-500">{certificate.course_title}</td>
                  <td className="px-4 py-3 text-night-400">{formatDate(certificate.issued_at)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={certificate.revoked_at ? "red" : "green"}>
                      {certificate.revoked_at ? "Révoqué" : "Valide"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/verifier-certificat?numero=${certificate.serial}`}
                        className="inline-flex items-center gap-1 rounded-full border border-night-200 px-3 py-1.5 text-xs font-medium text-night-600 hover:bg-night-50"
                      >
                        <ExternalLink className="h-3 w-3" aria-hidden />
                        Vérifier
                      </Link>
                      {!certificate.revoked_at && (
                        <RevokeCertificateButton
                          certificateId={certificate.id}
                          serial={certificate.serial}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
