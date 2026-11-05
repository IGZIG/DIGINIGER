import type { Metadata } from "next";
import Link from "next/link";
import {
  Wallet,
  Users,
  TrendingUp,
  TrendingDown,
  Clock,
  BadgeCheck,
  ArrowRight,
  Layers,
  Percent,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { PlanManager, type PlanRow } from "@/components/dashboard/plan-manager";
import {
  SubscriptionManager,
  type SubscriptionRow,
} from "@/components/dashboard/subscription-manager";
import { SettlementManager, type SettlementRow } from "@/components/dashboard/settlement-manager";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatXof, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Abonnements (admin)" };
export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage() {
  await requireRole(["admin"], "/admin/abonnements");

  let adminClient: ReturnType<typeof createAdminClient> | null = null;
  try {
    adminClient = createAdminClient();
  } catch {
    adminClient = null;
  }

  if (!adminClient) {
    return (
      <div className="rounded-2xl border border-gold-100 bg-gold-50 p-6 text-sm text-gold-800">
        La clé de service est absente sur ce serveur : l'analyse SaaS et les actions de
        facturation sont indisponibles. Aucune donnée n'est simulée.
      </div>
    );
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    { data: plans },
    { data: subscriptions },
    { data: transactions },
    { data: profiles },
    { count: studentCount },
  ] = await Promise.all([
    adminClient.from("plans").select("*").order("position", { ascending: true }),
    adminClient
      .from("subscriptions")
      .select("*, plan:plans(name_fr, price_xof), user:profiles!subscriptions_user_id_fkey(email, full_name)")
      .order("created_at", { ascending: false })
      .limit(300),
    adminClient
      .from("transactions")
      .select("*, user:profiles!transactions_user_id_fkey(email, full_name)")
      .order("created_at", { ascending: false })
      .limit(300),
    adminClient.from("profiles").select("id, email, full_name").eq("role", "student").order("created_at", { ascending: false }).limit(500),
    adminClient.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
  ]);

  const planList = plans ?? [];
  const subList = subscriptions ?? [];
  const txList = transactions ?? [];

  // --- Indicateurs SaaS -----------------------------------------------------
  const activeSubs = subList.filter(
    (row) => row.status === "active" && (!row.current_period_end || new Date(row.current_period_end) > now),
  );

  const mrrXof = activeSubs.reduce((sum, row) => sum + ((row.plan as any)?.price_xof ?? 0), 0);
  const payingUsers = new Set(activeSubs.map((row) => row.user_id)).size;
  const students = studentCount ?? 0;

  const paidTx = txList.filter((row) => row.status === "paid");
  const sumBetween = (from: Date, to?: Date) =>
    paidTx
      .filter((row) => {
        const at = new Date(row.paid_at ?? row.created_at);
        return at >= from && (!to || at < to);
      })
      .reduce((sum, row) => sum + (row.total_xof ?? 0), 0);

  const revenueThisMonth = sumBetween(startOfMonth);
  const revenueLastMonth = sumBetween(startOfLastMonth, startOfMonth);
  const growth =
    revenueLastMonth > 0
      ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 1000) / 10
      : null;

  const toVerify = paidTx.filter((row) => !(row.metadata as any)?.admin_review).length;
  const verified = paidTx.filter((row) => (row.metadata as any)?.admin_review?.decision === "verify").length;
  const pendingSettlements = txList.filter((row) => row.status === "pending").length;

  // --- Séries de préparation d'affichage -----------------------------------
  const planRows: PlanRow[] = planList.map((plan) => {
    const active = activeSubs.filter((row) => row.plan_id === plan.id);
    return {
      id: plan.id,
      code: plan.code,
      name_fr: plan.name_fr,
      name_en: plan.name_en,
      price_xof: plan.price_xof,
      interval: plan.interval,
      ai_messages_per_day: plan.ai_messages_per_day,
      is_active: plan.is_active,
      is_featured: plan.is_featured,
      position: plan.position,
      subscriberCount: active.length,
      mrrXof: active.reduce((sum, row) => sum + plan.price_xof, 0),
    };
  });

  const subscriptionRows: SubscriptionRow[] = subList.map((row) => ({
    id: row.id,
    userId: row.user_id,
    userEmail: (row.user as any)?.email ?? "—",
    userName: (row.user as any)?.full_name ?? "",
    planName: (row.plan as any)?.name_fr ?? "—",
    planPriceXof: (row.plan as any)?.price_xof ?? 0,
    status: row.status,
    provider: row.provider ?? null,
    currentPeriodEnd: row.current_period_end,
    createdAt: row.created_at,
  }));

  const settlementRows: SettlementRow[] = txList.map((row) => {
    const review = (row.metadata as any)?.admin_review;
    return {
      id: row.id,
      reference: row.reference,
      userEmail: (row.user as any)?.email ?? "—",
      userName: (row.user as any)?.full_name ?? "",
      amountXof: row.total_xof,
      provider: row.provider,
      providerRef: row.provider_ref,
      status: row.status,
      createdAt: row.created_at,
      paidAt: row.paid_at,
      reviewDecision: review?.decision ?? null,
      reviewBy: review?.by ?? null,
      reviewNote: review?.note ?? null,
    };
  });

  const planOptions = planList
    .filter((plan) => plan.is_active && plan.price_xof > 0)
    .map((plan) => ({ id: plan.id, name_fr: plan.name_fr, price_xof: plan.price_xof }));

  const studentOptions = (profiles ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    full_name: row.full_name,
  }));

  return (
    <div className="space-y-10">
      {/* --- Indicateurs SaaS ------------------------------------------------ */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Revenu mensuel récurrent"
          value={formatXof(mrrXof)}
          hint={`${activeSubs.length} abonnement(s) actif(s)`}
          icon={Wallet}
          tone="green"
        />
        <StatCard
          label="Encaissé ce mois"
          value={formatXof(revenueThisMonth)}
          hint={
            growth === null
              ? "pas de comparaison possible"
              : `${growth >= 0 ? "+" : ""}${growth} % vs mois dernier`
          }
          icon={growth !== null && growth < 0 ? TrendingDown : TrendingUp}
          tone={growth !== null && growth < 0 ? "gold" : "electric"}
        />
        <StatCard
          label="Taux de conversion"
          value={`${students > 0 ? Math.round((payingUsers / students) * 1000) / 10 : 0} %`}
          hint={`${payingUsers} payant(s) sur ${formatNumber(students)} apprenant(s)`}
          icon={Percent}
        />
        <StatCard
          label="Règlements à contrôler"
          value={toVerify}
          hint={`${verified} vérifié(s) · ${pendingSettlements} en attente de paiement`}
          icon={BadgeCheck}
          tone="gold"
        />
      </section>

      {/* --- Bandeau de synthèse --------------------------------------------- */}
      <section className="grid gap-3 rounded-2xl border border-night-100 bg-white p-5 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-night-300">Risque de revenu</p>
          <p className="mt-1 text-sm text-night-700">
            {subList.filter((row) => row.status === "past_due").length} abonnement(s) en retard de
            paiement · {subList.filter((row) => row.status === "canceled").length} résilié(s) au total
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-night-300">Contrôle financier</p>
          <p className="mt-1 text-sm text-night-700">
            {verified} règlement(s) vérifié(s) nominativement, {paidTx.length - verified} sans
            contrôle enregistré.
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-night-300">
            Règle appliquée par le serveur
          </p>
          <p className="mt-1 text-sm text-night-700">
            Un règlement « en attente » ne peut pas être marqué vérifié : aucun accès n'est ouvert
            sans argent réellement encaissé.
          </p>
        </div>
      </section>

      {/* --- Répartition ------------------------------------------------------ */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-night-100 bg-white p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Layers className="h-4 w-4 text-night-400" aria-hidden /> Revenu récurrent par offre
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            {planRows
              .filter((plan) => plan.mrrXof > 0 || plan.subscriberCount > 0)
              .sort((a, b) => b.mrrXof - a.mrrXof)
              .map((plan) => (
                <li key={plan.id} className="flex items-center justify-between gap-2">
                  <span className="text-night-600">
                    {plan.name_fr}{" "}
                    <span className="text-xs text-night-400">({plan.subscriberCount})</span>
                  </span>
                  <span className="font-medium text-night-800">{formatXof(plan.mrrXof)}</span>
                </li>
              ))}
            {mrrXof === 0 && (
              <li className="rounded-lg bg-mist/60 px-3 py-2 text-night-500">
                Aucun abonnement payant actif pour l'instant. Les offres ci-dessous sont visibles
                sur la page publique des tarifs.
              </li>
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-night-100 bg-white p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4 text-night-400" aria-hidden /> Règlements par moyen
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            {Object.entries(
              paidTx.reduce<Record<string, { count: number; total: number }>>((accumulator, row) => {
                const key = row.provider ?? "inconnu";
                accumulator[key] ??= { count: 0, total: 0 };
                accumulator[key].count += 1;
                accumulator[key].total += row.total_xof ?? 0;
                return accumulator;
              }, {}),
            ).map(([method, value]) => (
              <li key={method} className="flex items-center justify-between gap-2">
                <span className="text-night-600">
                  {method} <span className="text-xs text-night-400">({value.count})</span>
                </span>
                <span className="font-medium text-night-800">{formatXof(value.total)}</span>
              </li>
            ))}
            {paidTx.length === 0 && (
              <li className="rounded-lg bg-mist/60 px-3 py-2 text-night-500">
                Aucun règlement encaissé pour l'instant.
              </li>
            )}
          </ul>
          <Link
            href="/admin/paiements"
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-electric-600 hover:underline"
          >
            Voir les paiements et remboursements <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      </section>

      {/* --- Gestion des offres ---------------------------------------------- */}
      <PlanManager plans={planRows} />

      {/* --- Abonnements ------------------------------------------------------ */}
      <SubscriptionManager
        subscriptions={subscriptionRows}
        plans={planOptions}
        students={studentOptions}
      />

      {/* --- Règlements ------------------------------------------------------- */}
      <SettlementManager
        settlements={settlementRows}
        students={studentOptions}
        plans={planOptions}
      />

      <p className="rounded-xl bg-mist/60 px-4 py-3 text-xs text-night-500">
        <Users className="mr-1 inline h-3.5 w-3.5" aria-hidden />
        Toutes les actions de cette page sont journalisées dans le journal d'audit : auteur, date,
        avant et après. Aucun montant saisi dans un formulaire ne sert à ouvrir un accès.
      </p>
    </div>
  );
}
