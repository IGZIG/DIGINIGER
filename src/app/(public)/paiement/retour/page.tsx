import type { Metadata } from "next";
import Link from "next/link";
import { Clock } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { formatXof, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Paiement en cours de confirmation" };
export const dynamic = "force-dynamic";

/**
 * Retour du fournisseur de paiement.
 * Point crucial : cette page NE déclare JAMAIS le paiement comme réussi.
 * Elle lit l'état réel de la transaction, mis à jour uniquement par le webhook
 * signé. Tant que le webhook n'est pas arrivé, l'état affiché est « en attente ».
 */
export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const user = await getCurrentUser();
  const supabase = await createServerSupabase();

  const { data: transaction } =
    user && ref
      ? await supabase
          .from("transactions")
          .select("reference, status, total_xof, paid_at, plan_id, course_id")
          .eq("reference", ref)
          .eq("user_id", user.authId)
          .maybeSingle()
      : { data: null };

  const paid = transaction?.status === "paid";

  return (
    <div className="container-page py-20">
      <div className="mx-auto max-w-lg text-center">
        <div
          className={
            paid
              ? "mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"
              : "mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold-50 text-gold-600"
          }
        >
          <Clock className="h-8 w-8" aria-hidden />
        </div>

        <h1 className="mt-6 text-2xl font-semibold">
          {paid ? "Paiement confirmé" : "Paiement en cours de vérification"}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-night-500">
          {paid
            ? "Votre accès est ouvert. Vous pouvez commencer immédiatement."
            : "Nous attendons la confirmation du fournisseur de paiement. Dès qu'elle est reçue, votre accès s'ouvre automatiquement. Cette page se met à jour toute seule — vous pouvez aussi la recharger dans une minute."}
        </p>

        {transaction && (
          <dl className="mx-auto mt-6 max-w-sm space-y-2 rounded-2xl border border-night-100 bg-white p-4 text-left text-sm">
            <div className="flex justify-between">
              <dt className="text-night-400">Référence</dt>
              <dd className="font-mono text-xs">{transaction.reference}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-night-400">Montant</dt>
              <dd className="font-semibold">{formatXof(transaction.total_xof)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-night-400">Statut</dt>
              <dd className="font-medium">
                {transaction.status === "paid"
                  ? "Payé"
                  : transaction.status === "pending"
                    ? "En attente"
                    : transaction.status === "failed"
                      ? "Échoué"
                      : transaction.status}
              </dd>
            </div>
            {transaction.paid_at && (
              <div className="flex justify-between">
                <dt className="text-night-400">Confirmé le</dt>
                <dd>{formatDateTime(transaction.paid_at)}</dd>
              </div>
            )}
          </dl>
        )}

        <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
          <ButtonLink href="/app">Aller à mon espace</ButtonLink>
          <ButtonLink href="/app/abonnement" variant="outline">
            Voir mes transactions
          </ButtonLink>
        </div>

        <p className="mt-6 text-xs text-night-300">
          Un doute sur votre paiement ?{" "}
          <Link href="/contact" className="underline">Contactez le support</Link> en précisant la
          référence.
        </p>
      </div>
    </div>
  );
}
