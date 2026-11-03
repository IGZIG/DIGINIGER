import type { Metadata } from "next";
import { SectionTitle } from "@/components/ui/primitives";
import { CertificateVerifier } from "@/components/forms/certificate-verifier";

export const metadata: Metadata = {
  title: "Vérifier un certificat",
  description: "Vérifiez l'authenticité d'un certificat DIGINIGER grâce à son numéro unique.",
};

export default async function VerifyCertificatePage({
  searchParams,
}: {
  searchParams: Promise<{ numero?: string }>;
}) {
  const { numero } = await searchParams;

  return (
    <div className="container-page py-14">
      <div className="mx-auto max-w-3xl">
        <SectionTitle
          eyebrow="Vérification"
          title="Vérifier l'authenticité d'un certificat."
          description="Chaque certificat DIGINIGER possède un numéro unique. Saisissez-le pour confirmer le nom de l'apprenant, la formation suivie et la date d'obtention."
        />
        <div className="mt-8 rounded-3xl border border-night-100 bg-white p-6 shadow-soft sm:p-8">
          <CertificateVerifier initialSerial={numero} />
        </div>
        <p className="mt-6 text-xs leading-relaxed text-night-300">
          La vérification est publique et ne divulgue aucune donnée personnelle sensible : seuls le
          nom, la formation, le score et la date sont affichés.
        </p>
      </div>
    </div>
  );
}
