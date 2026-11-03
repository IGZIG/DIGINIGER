import type { Metadata } from "next";
import { XCircle } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Paiement annulé" };

export default function PaymentCancelledPage() {
  return (
    <div className="container-page py-20">
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-night-50 text-night-500">
          <XCircle className="h-8 w-8" aria-hidden />
        </div>
        <h1 className="mt-6 text-2xl font-semibold">Paiement annulé</h1>
        <p className="mt-3 text-sm text-night-500">
          Aucun montant n&apos;a été débité. Vous pouvez reprendre votre inscription à tout moment.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
          <ButtonLink href="/formations">Retour au catalogue</ButtonLink>
          <ButtonLink href="/tarifs" variant="outline">Voir les offres</ButtonLink>
        </div>
      </div>
    </div>
  );
}
