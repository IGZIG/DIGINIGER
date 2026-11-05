"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Search, ShieldQuestion, Plus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import {
  recordManualSettlementAction,
  reviewSettlementAction,
} from "@/lib/actions/billing-admin";
import { formatXof, formatDateTime } from "@/lib/utils";

export interface SettlementRow {
  id: string;
  reference: string;
  userEmail: string;
  userName: string;
  amountXof: number;
  provider: string;
  providerRef: string | null;
  status: string;
  createdAt: string;
  paidAt: string | null;
  reviewDecision: string | null;
  reviewBy: string | null;
  reviewNote: string | null;
}

const STATUS: Record<string, { label: string; tone: "green" | "gold" | "red" | "neutral" }> = {
  paid: { label: "encaissé", tone: "green" },
  pending: { label: "en attente", tone: "gold" },
  failed: { label: "échoué", tone: "red" },
  refunded: { label: "remboursé", tone: "neutral" },
};

/**
 * Contrôle des règlements.
 *
 * Règle appliquée et vérifiée côté serveur : on ne « vérifie » qu'un règlement
 * réellement encaissé (`paid`). Un règlement en attente ne peut pas être
 * marqué vérifié — cela ouvrirait un accès sans argent reçu. Le rejet n'ouvre
 * jamais d'accès et n'encaisse rien.
 */
export function SettlementManager({
  settlements,
  students,
  plans,
}: {
  settlements: SettlementRow[];
  students: Array<{ id: string; email: string; full_name: string | null }>;
  plans: Array<{ id: string; name_fr: string; price_xof: number }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("tous");
  const [showRecord, setShowRecord] = useState(false);

  const filtered = settlements.filter((row) => {
    const matchesQuery =
      query.trim() === "" ||
      `${row.reference} ${row.userEmail} ${row.userName} ${row.providerRef ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase());

    const matchesFilter =
      filter === "tous" ||
      (filter === "a_verifier" && row.status === "paid" && !row.reviewDecision) ||
      (filter === "verifies" && row.reviewDecision === "verify") ||
      (filter === "attente" && row.status === "pending");
    return matchesQuery && matchesFilter;
  });

  const toVerify = settlements.filter((row) => row.status === "paid" && !row.reviewDecision).length;
  const verified = settlements.filter((row) => row.reviewDecision === "verify").length;

  function review(row: SettlementRow, decision: "verify" | "reject") {
    const note =
      decision === "reject"
        ? window.prompt("Motif du rejet (journalisé) :") ?? undefined
        : window.prompt("Note de vérification (facultative) :") ?? undefined;
    if (decision === "reject" && !note) return;

    setError(null);
    setOk(null);
    startTransition(async () => {
      const result = await reviewSettlementAction({
        transactionId: row.id,
        decision,
        note: note || undefined,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOk(
        decision === "verify"
          ? `Règlement ${row.reference} marqué vérifié.`
          : `Règlement ${row.reference} rejeté.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Contrôle des règlements</h2>
          <p className="text-xs text-night-400">
            {toVerify} règlement(s) encaissé(s) à vérifier · {verified} déjà vérifié(s). Un règlement
            « en attente » ne peut pas être vérifié : l'argent n'est pas encore reçu.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowRecord(true)}>
          <Plus className="h-4 w-4" aria-hidden /> Enregistrer un règlement reçu
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
            placeholder="Référence, e-mail, référence fournisseur…"
            className="w-full rounded-lg border border-night-200 py-2 pl-9 pr-3 text-sm"
          />
        </label>
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="rounded-lg border border-night-200 px-3 py-2 text-sm"
        >
          <option value="tous">Tous</option>
          <option value="a_verifier">À vérifier</option>
          <option value="verifies">Vérifiés</option>
          <option value="attente">En attente de paiement</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-night-100 bg-white">
        <table className="w-full min-w-[940px] text-sm">
          <thead className="border-b border-night-100 bg-mist/60 text-left text-xs uppercase tracking-wider text-night-400">
            <tr>
              <th className="px-4 py-3">Référence</th>
              <th className="px-4 py-3">Apprenant</th>
              <th className="px-4 py-3">Montant</th>
              <th className="px-4 py-3">Moyen</th>
              <th className="px-4 py-3">État</th>
              <th className="px-4 py-3">Contrôle</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-night-50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-night-400">
                  Aucun règlement pour ce filtre.
                </td>
              </tr>
            )}
            {filtered.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3">
                  <p className="font-mono text-xs text-night-700">{row.reference}</p>
                  <p className="text-[11px] text-night-400">{formatDateTime(row.paidAt ?? row.createdAt)}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-night-700">{row.userName || "—"}</p>
                  <p className="text-xs text-night-400">{row.userEmail}</p>
                </td>
                <td className="px-4 py-3 font-semibold">{formatXof(row.amountXof)}</td>
                <td className="px-4 py-3 text-xs text-night-500">
                  {row.provider}
                  {row.providerRef && (
                    <span className="block font-mono text-[11px] text-night-400">{row.providerRef}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS[row.status]?.tone ?? "neutral"}>
                    {STATUS[row.status]?.label ?? row.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {row.reviewDecision === "verify" ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                      <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> vérifié
                    </span>
                  ) : row.reviewDecision === "reject" ? (
                    <span className="inline-flex items-center gap-1 text-xs text-red-600">
                      <XCircle className="h-3.5 w-3.5" aria-hidden /> rejeté
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-night-400">
                      <ShieldQuestion className="h-3.5 w-3.5" aria-hidden /> à vérifier
                    </span>
                  )}
                  {row.reviewNote && (
                    <p className="mt-0.5 max-w-[180px] truncate text-[11px] text-night-400" title={row.reviewNote}>
                      {row.reviewNote}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    {row.status === "paid" && !row.reviewDecision && (
                      <Button size="sm" variant="ghost" loading={pending} onClick={() => review(row, "verify")}>
                        <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Vérifier
                      </Button>
                    )}
                    {row.status !== "paid" && (
                      <Button size="sm" variant="ghost" loading={pending} onClick={() => review(row, "reject")}>
                        <XCircle className="h-3.5 w-3.5" aria-hidden /> Rejeter
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showRecord && (
        <RecordForm
          students={students}
          plans={plans}
          onClose={() => setShowRecord(false)}
          onSaved={(message) => {
            setShowRecord(false);
            setOk(message);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function RecordForm({
  students,
  plans,
  onClose,
  onSaved,
}: {
  students: Array<{ id: string; email: string; full_name: string | null }>;
  plans: Array<{ id: string; name_fr: string; price_xof: number }>;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    const raw = {
      userId: String(formData.get("userId") ?? ""),
      planId: String(formData.get("planId") ?? "") || undefined,
      amountXof: Number(formData.get("amountXof") ?? 0),
      method: String(formData.get("method") ?? "cash"),
      reference: String(formData.get("reference") ?? "").trim(),
      note: String(formData.get("note") ?? "").trim() || undefined,
      activateSubscription: formData.get("activateSubscription") === "on",
      months: Number(formData.get("months") ?? 1),
    };

    startTransition(async () => {
      const result = await recordManualSettlementAction(raw);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onSaved(`Règlement ${result.data.reference} enregistré.`);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-night-900/40 p-4 sm:p-8">
      <form action={submit} className="w-full max-w-lg rounded-2xl border border-night-100 bg-white p-6 shadow-xl">
        <h3 className="font-display text-lg font-semibold">Enregistrer un règlement reçu</h3>
        <p className="mt-1 text-xs text-night-400">
          Pour un encaissement hors plateforme : espèces, virement, mobile money direct. Le
          règlement est créé en « encaissé » et tracé à votre nom.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
          <label className="sm:col-span-2">
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
          <label>
            <span className="text-night-600">Montant reçu (FCFA)</span>
            <input name="amountXof" type="number" min={1} required className="mt-1 w-full rounded-lg border border-night-200 px-3 py-2" />
          </label>
          <label>
            <span className="text-night-600">Moyen</span>
            <select name="method" className="mt-1 w-full rounded-lg border border-night-200 px-3 py-2">
              <option value="mobile_money">Mobile Money</option>
              <option value="bank_transfer">Virement bancaire</option>
              <option value="cash">Espèces</option>
              <option value="cheque">Chèque</option>
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className="text-night-600">Référence externe (reçu, bordereau…)</span>
            <input name="reference" required minLength={3} className="mt-1 w-full rounded-lg border border-night-200 px-3 py-2" />
          </label>
          <label className="sm:col-span-2">
            <span className="text-night-600">Note interne (facultative)</span>
            <input name="note" className="mt-1 w-full rounded-lg border border-night-200 px-3 py-2" />
          </label>
          <label className="sm:col-span-2 flex items-center gap-2">
            <input type="checkbox" name="activateSubscription" /> Activer un abonnement avec ce règlement
          </label>
          <label>
            <span className="text-night-600">Offre</span>
            <select name="planId" className="mt-1 w-full rounded-lg border border-night-200 px-3 py-2">
              <option value="">— aucune —</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name_fr} — {formatXof(plan.price_xof)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-night-600">Durée (mois)</span>
            <input name="months" type="number" min={1} max={36} defaultValue={1} className="mt-1 w-full rounded-lg border border-night-200 px-3 py-2" />
          </label>
        </div>

        {error && <div className="mt-3"><Alert tone="error">{error}</Alert></div>}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={pending}>Enregistrer</Button>
        </div>
      </form>
    </div>
  );
}
