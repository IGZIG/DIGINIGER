import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, CheckCircle2, Clock, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/primitives-badge";
import { EmptyState } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getMySubscription, listMyTransactions } from "@/lib/queries";
import { formatDate, formatDateTime, formatXof } from "@/lib/utils";

export const metadata = { title: "Mon abonnement" };
export const dynamic = "force-dynamic";

export default async function SubscriptionPage() {
  const user = await requireUser("/app/abonnement");
  const [subscription, transactions] = await Promise.all([
    getMySubscription(user.authId),
    listMyTransactions(user.authId),
  ]);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-night-100 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-night-300">
              Offre actuelle
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold">
              {subscription?.plan?.name_fr ?? "Gratuit"}
            </h2>
            {subscription ? (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-night-400">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {subscription.current_period_end
                  ? `Renouvellement le ${formatDate(subscription.current_period_end)}`
                  : "Accès permanent"}
              </p>
            ) : (
              <p className="mt-1 text-sm text-night-400">
                Accès aux formations gratuites et 10 messages de tuteur par jour.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <ButtonLink href="/tarifs">Voir les offres</ButtonLink>
            {subscription && (
              <ButtonLink href="/contact" variant="outline">
                Gérer mon abonnement
              </ButtonLink>
            )}
          </div>
        </div>

        {subscription && (
          <ul className="mt-5 grid gap-2 border-t border-night-100 pt-4 text-sm text-night-500 sm:grid-cols-2">
            {subscription.plan.features_fr.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                {feature}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Receipt className="h-4 w-4 text-night-400" aria-hidden />
          Historique des transactions
        </h2>

        {transactions.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={<CreditCard className="h-5 w-5" />}
              title="Aucune transaction"
              description="Vos achats de formations et abonnements apparaîtront ici."
              action={<ButtonLink href="/tarifs" variant="outline">Découvrir les offres</ButtonLink>}
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-night-100 bg-white">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-mist text-left text-xs uppercase tracking-wider text-night-400">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Référence</th>
                  <th scope="col" className="px-4 py-3 font-medium">Date</th>
                  <th scope="col" className="px-4 py-3 font-medium">Montant</th>
                  <th scope="col" className="px-4 py-3 font-medium">Moyen</th>
                  <th scope="col" className="px-4 py-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-night-100">
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="px-4 py-3 font-mono text-xs">{transaction.reference}</td>
                    <td className="px-4 py-3 text-night-500">
                      {formatDateTime(transaction.created_at)}
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatXof(transaction.total_xof)}</td>
                    <td className="px-4 py-3 text-night-500">
                      {transaction.provider === "mobile_money"
                        ? "Mobile Money"
                        : transaction.provider === "card"
                          ? "Carte bancaire"
                          : "Manuel"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          transaction.status === "paid"
                            ? "green"
                            : transaction.status === "pending"
                              ? "gold"
                              : transaction.status === "refunded"
                                ? "electric"
                                : "red"
                        }
                      >
                        {transaction.status === "paid"
                          ? "Payé"
                          : transaction.status === "pending"
                            ? "En attente"
                            : transaction.status === "failed"
                              ? "Échoué"
                              : transaction.status === "refunded"
                                ? "Remboursé"
                                : "Annulé"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-xs text-night-300">
          Besoin d&apos;une facture ou d&apos;un remboursement ?{" "}
          <Link href="/contact" className="underline">Contactez le support</Link> en précisant la
          référence de la transaction.
        </p>
      </section>
    </div>
  );
}
