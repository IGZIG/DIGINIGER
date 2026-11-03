import type { Metadata } from "next";
import Link from "next/link";
import {
  Users,
  BookOpen,
  CreditCard,
  Award,
  Sparkles,
  Inbox,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { RevenueChart, EnrollmentChart } from "@/components/dashboard/charts";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatXof, formatNumber, formatDateTime } from "@/lib/utils";
import type { AdminStats } from "@/types/database";

export const metadata: Metadata = { title: "Administration" };
export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await requireRole(["admin"], "/admin");
  const supabase = await createServerSupabase();

  // Les indicateurs agrégés et le journal d'audit passent par la clé
  // service_role : la fonction est REVOKE pour anon/authenticated et la table
  // audit_logs n'est lisible par aucun client. Le rôle admin est vérifié
  // juste au-dessus (requireRole), la clé ne quitte jamais le serveur.
  const adminClient = createAdminClient();
  const { data: statsData } = await adminClient.rpc("admin_dashboard_stats");
  const stats = (statsData ?? {
    students: 0,
    instructors: 0,
    courses_published: 0,
    courses_draft: 0,
    enrollments: 0,
    completions: 0,
    certificates: 0,
    revenue_xof: 0,
    active_subscriptions: 0,
    ai_messages_today: 0,
    pending_applications: 0,
    revenue_by_month: [],
    enrollments_by_school: [],
  }) as AdminStats;

  const [{ data: recentTransactions }, { data: pendingCourses }, { data: auditLogs }] =
    await Promise.all([
      supabase
        .from("transactions")
        .select("id, reference, total_xof, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("courses")
        .select("id, title_fr, status, updated_at, instructor:profiles!courses_instructor_id_fkey(full_name)")
        .eq("status", "in_review")
        .order("updated_at", { ascending: false })
        .limit(5),
      adminClient
        .from("audit_logs")
        .select("id, action, entity, created_at, actor_role")
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Apprenants" value={formatNumber(stats.students)} hint={`${stats.instructors} formateur(s)`} icon={Users} />
        <StatCard label="Formations publiées" value={stats.courses_published} hint={`${stats.courses_draft} en attente/brouillon`} icon={BookOpen} tone="gold" />
        <StatCard label="Revenus encaissés" value={formatXof(stats.revenue_xof)} hint={`${stats.active_subscriptions} abonnement(s) actif(s)`} icon={CreditCard} tone="green" />
        <StatCard label="Certificats" value={stats.certificates} hint={`${stats.completions} formations terminées`} icon={Award} tone="night" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Inscriptions" value={formatNumber(stats.enrollments)} icon={TrendingUp} />
        <StatCard label="Messages IA aujourd'hui" value={formatNumber(stats.ai_messages_today)} icon={Sparkles} tone="gold" />
        <StatCard label="Demandes à traiter" value={stats.pending_applications} icon={Inbox} tone="night" />
        <StatCard
          label="Taux de complétion"
          value={`${stats.enrollments ? Math.round((stats.completions / stats.enrollments) * 100) : 0} %`}
          icon={Award}
          tone="green"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-night-100 bg-white p-5">
          <h2 className="text-sm font-semibold">Revenus des 12 derniers mois</h2>
          {stats.revenue_by_month.length ? (
            <RevenueChart data={stats.revenue_by_month} />
          ) : (
            <p className="mt-6 text-sm text-night-400">
              Aucune transaction confirmée : le graphique s&apos;affichera à la première vente.
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-night-100 bg-white p-5">
          <h2 className="text-sm font-semibold">Inscriptions par école</h2>
          {stats.enrollments_by_school.length ? (
            <EnrollmentChart data={stats.enrollments_by_school} />
          ) : (
            <p className="mt-6 text-sm text-night-400">Aucune inscription enregistrée.</p>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-night-100 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Formations à valider</h2>
            <Link href="/admin/formations" className="text-xs font-medium text-electric-600 hover:underline">
              Tout voir
            </Link>
          </div>
          {(pendingCourses ?? []).length === 0 ? (
            <p className="mt-4 text-sm text-night-400">Aucune formation en attente de validation.</p>
          ) : (
            <ul className="mt-3 divide-y divide-night-100">
              {(pendingCourses ?? []).map((course) => {
                const typed = course as unknown as {
                  id: string;
                  title_fr: string;
                  instructor?: { full_name?: string } | null;
                };
                return (
                  <li key={typed.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-night-700">{typed.title_fr}</p>
                      <p className="text-xs text-night-400">
                        {typed.instructor?.full_name ?? "Formateur"}
                      </p>
                    </div>
                    <Badge tone="gold">À relire</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-night-100 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Dernières transactions</h2>
            <Link href="/admin/paiements" className="text-xs font-medium text-electric-600 hover:underline">
              Tout voir
            </Link>
          </div>
          {(recentTransactions ?? []).length === 0 ? (
            <p className="mt-4 text-sm text-night-400">Aucune transaction enregistrée.</p>
          ) : (
            <ul className="mt-3 divide-y divide-night-100">
              {(recentTransactions ?? []).map((transaction) => (
                <li key={transaction.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs">{transaction.reference}</p>
                    <p className="text-xs text-night-400">{formatDateTime(transaction.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{formatXof(transaction.total_xof)}</span>
                    <Badge
                      tone={
                        transaction.status === "paid"
                          ? "green"
                          : transaction.status === "pending"
                            ? "gold"
                            : "red"
                      }
                    >
                      {transaction.status === "paid"
                        ? "Payé"
                        : transaction.status === "pending"
                          ? "En attente"
                          : transaction.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-night-100 bg-white p-5">
        <h2 className="text-sm font-semibold">Journal d&apos;audit (activité récente)</h2>
        {(auditLogs ?? []).length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={<Inbox className="h-5 w-5" />}
              title="Journal vide"
              description="Les actions sensibles (inscriptions, examens, certificats, rôles) sont journalisées ici."
              action={<ButtonLink href="/admin/parametres" variant="outline" size="sm">Voir les paramètres</ButtonLink>}
            />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-night-100">
            {(auditLogs ?? []).map((log) => (
              <li key={log.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="font-mono text-xs text-night-600">{log.action}</span>
                <span className="text-xs text-night-400">
                  {log.entity} · {formatDateTime(log.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
