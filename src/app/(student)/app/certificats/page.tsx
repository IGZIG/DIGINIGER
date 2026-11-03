import type { Metadata } from "next";
import Link from "next/link";
import { Award, Download, ExternalLink, ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { listMyCertificates } from "@/lib/queries";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Mes certificats" };
export const dynamic = "force-dynamic";

export default async function CertificatesPage() {
  const user = await requireUser("/app/certificats");
  const certificates = await listMyCertificates(user.authId);
  const valid = certificates.filter((certificate) => !certificate.revoked_at);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Mes certificats ({valid.length})</h2>
        <p className="text-sm text-night-400">
          Chaque certificat porte un numéro unique vérifiable publiquement et un QR code.
        </p>
      </div>

      {certificates.length === 0 ? (
        <EmptyState
          icon={<Award className="h-5 w-5" />}
          title="Aucun certificat pour le moment"
          description="Terminez toutes les leçons d'une formation et réussissez ses examens pour débloquer votre certificat."
          action={<ButtonLink href="/app/mes-formations">Voir mes formations</ButtonLink>}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {certificates.map((certificate) => (
            <li
              key={certificate.id}
              className="relative overflow-hidden rounded-2xl border border-night-100 bg-white p-5 shadow-soft"
            >
              <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-gold-50" aria-hidden />
              <div className="relative">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-100 text-gold-700">
                    <Award className="h-5 w-5" aria-hidden />
                  </span>
                  {certificate.revoked_at ? (
                    <Badge tone="red">Révoqué</Badge>
                  ) : (
                    <Badge tone="green">
                      <ShieldCheck className="h-3 w-3" aria-hidden />
                      Valide
                    </Badge>
                  )}
                </div>

                <h3 className="mt-3 font-semibold leading-snug">{certificate.course_title}</h3>
                <p className="mt-1 text-xs text-night-400">
                  Délivré le {formatDate(certificate.issued_at)}
                  {certificate.score != null && ` · Score ${certificate.score}/100`}
                </p>
                <p className="mt-2 font-mono text-xs text-night-500">{certificate.serial}</p>

                {!certificate.revoked_at && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      href={`/api/certificates/${certificate.serial}/pdf`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-night-800 px-3.5 py-2 text-xs font-medium text-white hover:bg-night-700"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden />
                      Télécharger le PDF
                    </a>
                    <Link
                      href={`/verifier-certificat?numero=${certificate.serial}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-night-200 px-3.5 py-2 text-xs font-medium text-night-600 hover:bg-night-50"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      Vérifier en ligne
                    </Link>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
