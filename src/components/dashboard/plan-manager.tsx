"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { togglePlanAction, savePlanAction } from "@/lib/actions/billing-admin";
import { formatXof } from "@/lib/utils";

export interface PlanRow {
  id: string;
  code: string;
  name_fr: string;
  name_en: string | null;
  price_xof: number;
  interval: string;
  ai_messages_per_day: number;
  is_active: boolean;
  is_featured: boolean;
  position: number;
  subscriberCount: number;
  mrrXof: number;
}

const INTERVALS: Record<string, string> = {
  month: "par mois",
  year: "par an",
  one_time: "paiement unique",
};

/**
 * Gestion des offres d'abonnement.
 * Le prix est saisi en francs CFA entiers ; le serveur revalide tout et
 * journalise chaque changement (avant / après).
 */
export function PlanManager({ plans }: { plans: PlanRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PlanRow | "new" | null>(null);

  function toggle(plan: PlanRow) {
    setError(null);
    startTransition(async () => {
      const result = await togglePlanAction(plan.id, !plan.is_active);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Offres d'abonnement</h2>
          <p className="text-xs text-night-400">
            Une offre désactivée disparaît de la page publique des tarifs et ne peut plus être
            souscrite. Les abonnements en cours restent valides jusqu'à leur terme.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" aria-hidden /> Nouvelle offre
        </Button>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="overflow-x-auto rounded-2xl border border-night-100 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-night-100 bg-mist/60 text-left text-xs uppercase tracking-wider text-night-400">
            <tr>
              <th className="px-4 py-3">Offre</th>
              <th className="px-4 py-3">Prix</th>
              <th className="px-4 py-3">Tuteur IA / jour</th>
              <th className="px-4 py-3">Abonnés</th>
              <th className="px-4 py-3">Revenu mensuel</th>
              <th className="px-4 py-3">État</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-night-50">
            {plans.map((plan) => (
              <tr key={plan.id} className={plan.is_active ? "" : "bg-mist/30"}>
                <td className="px-4 py-3">
                  <p className="font-medium text-night-800">{plan.name_fr}</p>
                  <p className="text-xs text-night-400">
                    code {plan.code}
                    {plan.is_featured && " · mise en avant"}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span className="font-semibold">{formatXof(plan.price_xof)}</span>
                  <span className="ml-1 text-xs text-night-400">
                    {INTERVALS[plan.interval] ?? plan.interval}
                  </span>
                </td>
                <td className="px-4 py-3 text-night-600">{plan.ai_messages_per_day}</td>
                <td className="px-4 py-3 text-night-600">{plan.subscriberCount}</td>
                <td className="px-4 py-3 font-medium text-night-700">{formatXof(plan.mrrXof)}</td>
                <td className="px-4 py-3">
                  {plan.is_active ? (
                    <Badge tone="green">active</Badge>
                  ) : (
                    <Badge tone="neutral">désactivée</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(plan)}>
                      <Pencil className="h-3.5 w-3.5" aria-hidden /> Modifier
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={pending}
                      onClick={() => toggle(plan)}
                    >
                      <Power className="h-3.5 w-3.5" aria-hidden />
                      {plan.is_active ? "Désactiver" : "Activer"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <PlanForm
          plan={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function PlanForm({
  plan,
  onClose,
  onSaved,
}: {
  plan: PlanRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    const raw = {
      id: plan?.id,
      code: String(formData.get("code") ?? "").trim().toLowerCase(),
      name_fr: String(formData.get("name_fr") ?? "").trim(),
      name_en: String(formData.get("name_en") ?? "").trim() || undefined,
      price_xof: Number(formData.get("price_xof") ?? 0),
      interval: String(formData.get("interval") ?? "month"),
      ai_messages_per_day: Number(formData.get("ai_messages_per_day") ?? 0),
      is_active: formData.get("is_active") === "on",
      is_featured: formData.get("is_featured") === "on",
      position: Number(formData.get("position") ?? 0),
    };

    startTransition(async () => {
      const result = await savePlanAction(raw);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onSaved();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-night-900/40 p-4 sm:p-8">
      <form
        action={submit}
        className="w-full max-w-lg rounded-2xl border border-night-100 bg-white p-6 shadow-xl"
      >
        <h3 className="font-display text-lg font-semibold">
          {plan ? `Modifier « ${plan.name_fr} »` : "Nouvelle offre"}
        </h3>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-night-600">Nom (français)</span>
            <input name="name_fr" defaultValue={plan?.name_fr ?? ""} required className="mt-1 w-full rounded-lg border border-night-200 px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="text-night-600">Nom (anglais)</span>
            <input name="name_en" defaultValue={plan?.name_en ?? ""} className="mt-1 w-full rounded-lg border border-night-200 px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="text-night-600">Code interne</span>
            <input name="code" defaultValue={plan?.code ?? ""} required pattern="[a-z0-9-]+" className="mt-1 w-full rounded-lg border border-night-200 px-3 py-2" />
            <span className="text-[11px] text-night-400">minuscules, chiffres et tirets</span>
          </label>
          <label className="text-sm">
            <span className="text-night-600">Prix (FCFA)</span>
            <input name="price_xof" type="number" min={0} step={100} defaultValue={plan?.price_xof ?? 0} required className="mt-1 w-full rounded-lg border border-night-200 px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="text-night-600">Périodicité</span>
            <select name="interval" defaultValue={plan?.interval ?? "month"} className="mt-1 w-full rounded-lg border border-night-200 px-3 py-2">
              <option value="month">par mois</option>
              <option value="year">par an</option>
              <option value="one_time">paiement unique</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="text-night-600">Messages du tuteur IA / jour</span>
            <input name="ai_messages_per_day" type="number" min={0} defaultValue={plan?.ai_messages_per_day ?? 10} required className="mt-1 w-full rounded-lg border border-night-200 px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="text-night-600">Ordre d'affichage</span>
            <input name="position" type="number" min={0} defaultValue={plan?.position ?? 0} className="mt-1 w-full rounded-lg border border-night-200 px-3 py-2" />
          </label>
          <div className="flex flex-col justify-end gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="is_active" defaultChecked={plan?.is_active ?? true} /> Active (visible publiquement)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="is_featured" defaultChecked={plan?.is_featured ?? false} /> Mise en avant
            </label>
          </div>
        </div>

        {error && <div className="mt-3"><Alert tone="error">{error}</Alert></div>}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={pending}>{plan ? "Enregistrer" : "Créer l'offre"}</Button>
        </div>
      </form>
    </div>
  );
}
