import type { Metadata } from "next";
import { CreditCard, Ticket, Undo2, Info } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { PromoToggle } from "@/components/dashboard/admin-actions";
import { PromoCodeForm } from "@/components/forms/promo-code-form";
import { RefundActions } from "@/components/dashboard/refund-actions";
import { requireRole } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { paymentStatus } from "@/lib/payments/provider";
import { formatDateTime, formatXof } from "@/lib/utils";

export const metadata: Metadata = { title: "Paiements (admin)" };
export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  await requireRole(["admin"], "/admin/paiements");
  const supabase = await createServerSupabase();

  const [{ data: transactions }, { data: promos }, { data: refunds }] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60),
    supabase.from("promo_codes").select("*").order("created_at", { ascending: false }),
    supabase
      .from("refunds")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const rows = transactions ?? [];
  const paid = rows.filter((row) => row.status === "paid");
  const revenue = paid.reduce((sum, row) => sum + row.total_xof, 0);
  const pending = rows.filter((row) => row.status === "pending");
  const provider = paymentStatus();

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenus encaissés" value={formatXof(revenue)} hint={`${paid.length} paiement(s)`} icon={CreditCard} tone="green" />
        <StatCard label="En attente" value={pending.length} hint="Transactions non confirmées" icon={CreditCard} tone="gold" />
        <StatCard label="Codes promo actifs" value={(promos ?? []).filter((promo) => promo.is_active).length} icon={Ticket} />
        <StatCard label="Remboursements" value={(refunds ?? []).length} icon={Undo2} tone="night" />
      </section>

      {/* État du fournisseur de paiement : transparence totale */}
      <section className="rounded-2xl border border-night-100 bg-white p-5">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-electric-500" aria-hidden />
          <div className="text-sm leading-relaxed text-night-600">
            <p className="font-semibold">État du fournisseur de paiement</p>
            <p className="mt-1">
              Fournisseur Mobile Money : <strong>{provider.vendor}</strong> ·{" "}
              Mobile Money :{" "}
              <strong className={provider.mobileMoney ? "text-emerald-700" : "text-red-600"}>
                {provider.mobileMoney ? "configuré" : "non configuré"}
              </strong>{" "}
              · Carte bancaire :{" "}
              <strong className={provider.card ? "text-emerald-700" : "text-red-600"}>
                {provider.card ? "configuré" : "non configuré"}
              </strong>{" "}
              · Mode : <strong>{provider.mode}</strong>
            </p>
            {!provider.mobileMoney && !provider.card && (
              <p className="mt-2 rounded-xl bg-gold-50 px-3 py-2 text-xs text-gold-800">
                Aucun fournisseur n&apos;est configuré : le tunnel de paiement répond explicitement
                « non configuré » au lieu de simuler un succès. Renseignez les variables
                <code className="mx-1 rounded bg-white px-1">PAYMENT_*</code> pour l&apos;activer.
                Les accès ne sont jamais ouverts sans webhook signé.
              </p>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Transactions</h2>
        {rows.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-white p-6 text-sm text-night-400">
            Aucune transaction enregistrée. Les paiements apparaîtront ici dès la première tentative.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-night-100 bg-white">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-mist text-left text-xs uppercase tracking-wider text-night-400">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Référence</th>
                  <th scope="col" className="px-4 py-3 font-medium">Date</th>
                  <th scope="col" className="px-4 py-3 font-medium">Montant</th>
                  <th scope="col" className="px-4 py-3 font-medium">Moyen</th>
                  <th scope="col" className="px-4 py-3 font-medium">Objet</th>
                  <th scope="col" className="px-4 py-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-night-100">
                {rows.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="px-4 py-3 font-mono text-xs">{transaction.reference}</td>
                    <td className="px-4 py-3 text-night-400">{formatDateTime(transaction.created_at)}</td>
                    <td className="px-4 py-3 font-semibold">{formatXof(transaction.total_xof)}</td>
                    <td className="px-4 py-3 text-night-500">
                      {transaction.provider === "mobile_money"
                        ? "Mobile Money"
                        : transaction.provider === "card"
                          ? "Carte"
                          : "Manuel"}
                    </td>
                    <td className="px-4 py-3 text-night-500">
                      {transaction.plan_id ? "Abonnement" : transaction.course_id ? "Formation" : "—"}
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
                        {transaction.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-night-100 bg-white p-5">
          <h2 className="text-sm font-semibold">Codes promotionnels</h2>
          {(promos ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-night-400">Aucun code promo.</p>
          ) : (
            <ul className="mt-3 divide-y divide-night-100">
              {(promos ?? []).map((promo) => (
                <li key={promo.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div>
                    <p className="font-mono text-sm font-semibold">{promo.code}</p>
                    <p className="text-xs text-night-400">
                      {promo.kind === "percent" ? `-${promo.value} %` : `-${formatXof(promo.value)}`} ·{" "}
                      {promo.times_redeemed}/{promo.max_redemptions} utilisés
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={promo.is_active ? "green" : "neutral"}>
                      {promo.is_active ? "Actif" : "Inactif"}
                    </Badge>
                    <PromoToggle promoId={promo.id} isActive={promo.is_active} />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 border-t border-night-100 pt-4">
            <PromoCodeForm />
          </div>
        </section>

        <section className="rounded-2xl border border-night-100 bg-white p-5">
          <h2 className="text-sm font-semibold">Remboursements demandés</h2>
          {(refunds ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-night-400">
              Aucune demande. Les apprenants peuvent en déposer une depuis leur espace abonnement.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-night-100">
              {(refunds ?? []).map((refund) => (
                <li key={refund.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div>
                    <p className="text-sm">{formatXof(refund.amount_xof)}</p>
                    <p className="text-xs text-night-400">
                      {formatDateTime(refund.created_at)} · {refund.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={
                        refund.status === "processed"
                          ? "green"
                          : refund.status === "refused"
                            ? "red"
                            : "gold"
                      }
                    >
                      {refund.status}
                    </Badge>
                    {(refund.status === "requested" || refund.status === "approved") && (
                      <RefundActions refundId={refund.id} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
