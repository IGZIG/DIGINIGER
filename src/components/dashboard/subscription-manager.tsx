"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gift, Ban, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { grantSubscriptionAction, setSubscriptionStatusAction } from "@/lib/actions/billing-admin";
import { formatXof, formatDate } from "@/lib/utils";

export interface SubscriptionRow {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  planName: string;
  planPriceXof: number;
  status: string;
  provider: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
}

export interface PlanOption {
  id: string;
  name_fr: string;
  price_xof: number;
}

const STATUS_LABEL: Record<string, { label: string; tone: "green" | "gold" | "red" | "neutral" }> = {
  active: { label: "actif", tone: "green" },
  trialing: { label: "essai", tone: "electric" as never },
  past_due: { label: "en retard", tone: "gold" },
  canceled: { label: "résilié", tone: "red" },
  expired: { label: "expiré", tone: "neutral" },
};

/**
 * Gestion des abonnements par l'administrateur.
 * - octroi manuel (geste commercial, virement reçu hors plateforme) ;
 * - suspension / réactivation avec motif obligatoire.
 * Le montant n'est jamais saisi pour un octroi : il est déduit du prix de
 * l'offre en base, et l'action est journalisée avec son auteur.
 */
export function SubscriptionManager({
  subscriptions,
  plans,
  students,
}: {
  subscriptions: SubscriptionRow[];
  plans: PlanOption[];
  students: Array<{ id: string; email: string; full_name: string | null }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("tous");
  const [showGrant, setShowGrant] = useState(false);

  const filtered = subscriptions.filter((row) => {
    const matchesQuery =
      query.trim() === "" ||
      `${row.userName} ${row.userEmail} ${row.planName}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === "tous" || row.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  function changeStatus(row: SubscriptionRow, status: string) {
    const reason = window.prompt(
      `Motif de la mise à « ${STATUS_LABEL[status]?.label ?? status} » (obligatoire, journalisé) :`,
    );
    if (!reason || reason.trim().length < 5) {
      setError("Motif trop court : l'action a été annulée.");
      return;
    }
    setError(null);
    setOk(null);
    startTransition(async () => {
      const result = await setSubscriptionStatusAction(
        row.id,
        status as "active" | "canceled" | "past_due" | "expired",
        reason,
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOk(`Abonnement de ${row.userEmail} mis à jour.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Abonnements en cours</h2>
          <p className="text-xs text-night-400">
            {subscriptions.length} abonnement(s) enregistré(s). Toute modification est horodatée
            dans le journal d'audit avec votre identité et le motif.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowGrant(true)}>
          <Gift className="h-4 w-4" aria-hidden /> Octroyer un abonnement
        </Button>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {ok && <Alert tone="success">{ok}</Alert>}

      <div className="flex flex-wrap gap-2">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-night-300" aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un apprenant, une offre…"
            className="w-full rounded-lg border border-night-200 py-2 pl-9 pr-3 text-sm"
          />
        </label>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-lg border border-night-200 px-3 py-2 text-sm"
        >
          <option value="tous">Tous les états</option>
          <option value="active">Actifs</option>
          <option value="past_due">En retard</option>
          <option value="canceled">Résiliés</option>
          <option value="expired">Expirés</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-night-100 bg-white">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-night-100 bg-mist/60 text-left text-xs uppercase tracking-wider text-night-400">
            <tr>
              <th className="px-4 py-3">Apprenant</th>
              <th className="px-4 py-3">Offre</th>
              <th className="px-4 py-3">Échéance</th>
              <th className="px-4 py-3">Origine</th>
              <th className="px-4 py-3">État</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-night-50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-night-400">
                  Aucun abonnement ne correspond à cette recherche.
                </td>
              </tr>
            )}
            {filtered.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-night-800">{row.userName || "—"}</p>
                  <p className="text-xs text-night-400">{row.userEmail}</p>
                </td>
                <td className="px-4 py-3">
                  {row.planName}
                  <span className="ml-1 text-xs text-night-400">{formatXof(row.planPriceXof)}</span>
                </td>
                <td className="px-4 py-3 text-night-600">
                  {row.currentPeriodEnd ? formatDate(row.currentPeriodEnd) : "—"}
                </td>
                <td className="px-4 py-3 text-xs text-night-500">{row.provider ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_LABEL[row.status]?.tone ?? "neutral"}>
                    {STATUS_LABEL[row.status]?.label ?? row.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    {row.status === "active" ? (
                      <Button size="sm" variant="ghost" loading={pending} onClick={() => changeStatus(row, "canceled")}>
                        <Ban className="h-3.5 w-3.5" aria-hidden /> Suspendre
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" loading={pending} onClick={() => changeStatus(row, "active")}>
                        Réactiver
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showGrant && (
        <GrantForm
          plans={plans}
          students={students}
          onClose={() => setShowGrant(false)}
          onSaved={(message) => {
            setShowGrant(false);
            setOk(message);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function GrantForm({
  plans,
  students,
  onClose,
  onSaved,
}: {
  plans: PlanOption[];
  students: Array<{ id: string; email: string; full_name: string | null }>;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    const raw = {
      userId: String(formData.get("userId") ?? ""),
      planId: String(formData.get("planId") ?? ""),
      months: Number(formData.get("months") ?? 1),
      reason: String(formData.get("reason") ?? "").trim(),
    };

    startTransition(async () => {
      const result = await grantSubscriptionAction(raw);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onSaved("Abonnement octroyé et journalisé.");
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-night-900/40 p-4 sm:p-8">
      <form action={submit} className="w-full max-w-lg rounded-2xl border border-night-100 bg-white p-6 shadow-xl">
        <h3 className="font-display text-lg font-semibold">Octroyer un abonnement</h3>
        <p className="mt-1 text-xs text-night-400">
          À utiliser pour un geste commercial ou un paiement reçu en dehors de la plateforme.
          Le montant est déduit du prix de l'offre ; l'action est journalisée.
        </p>

        <div className="mt-4 space-y-3 text-sm">
          <label className="block">
            <span className="text-night-600">Apprenant</span>
            <select name="userId" required className="mt-1 w-full rounded-lg border border-night-200 px-3 py-2">
              <option value="">— choisir —</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.full_name ?? "Sans nom"} — {student.email}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-night-600">Offre</span>
            <select name="planId" required className="mt-1 w-full rounded-lg border border-night-200 px-3 py-2">
              <option value="">— choisir —</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name_fr} — {formatXof(plan.price_xof)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-night-600">Durée (mois)</span>
            <input name="months" type="number" min={1} max={36} defaultValue={1} required className="mt-1 w-full rounded-lg border border-night-200 px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-night-600">Motif (journalisé, 5 caractères minimum)</span>
            <input name="reason" required minLength={5} className="mt-1 w-full rounded-lg border border-night-200 px-3 py-2" placeholder="ex. virement reçu le 12/11, geste commercial" />
          </label>
        </div>

        {error && <div className="mt-3"><Alert tone="error">{error}</Alert></div>}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={pending}>Octroyer</Button>
        </div>
      </form>
    </div>
  );
}
