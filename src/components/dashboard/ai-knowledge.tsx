"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpenCheck, Database, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";

interface KnowledgeState {
  configured: boolean;
  total: number;
  indexed: number;
  pending: number;
  chunks: number;
  documents: Array<{
    id: string;
    course_id: string;
    title: string;
    status: string;
    chunk_count: number | null;
    error: string | null;
  }>;
}

interface IndexRun {
  processed: number;
  succeeded: number;
  failed: number;
  remaining: number;
  totalChunks: number;
  results: Array<{ title: string; chunks: number; ok: boolean; error?: string }>;
  message?: string;
}

/**
 * Base de connaissances du tuteur.
 * Affiche l'état réel (documents indexés / en attente, nombre de passages) et
 * permet de lancer l'indexation depuis le navigateur, sans ligne de commande.
 * Aucune réussite n'est simulée : chaque échec affiche sa cause.
 */
export function AiKnowledge() {
  const [state, setState] = useState<KnowledgeState | null>(null);
  const [run, setRun] = useState<IndexRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/ai/index", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error === "FORBIDDEN" ? "Réservé aux administrateurs." : "État indisponible.");
        return;
      }
      setState(payload as KnowledgeState);
      setError(null);
    } catch {
      setError("Impossible de lire l'état (réseau).");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function index(force: boolean) {
    setLoading(true);
    setError(null);
    setRun(null);
    try {
      const response = await fetch("/api/admin/ai/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 3, force }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.message ?? payload.error ?? "Indexation impossible.");
        return;
      }
      setRun(payload as IndexRun);
      await load();
    } catch {
      setError("L'indexation n'a pas abouti (réseau).");
    } finally {
      setLoading(false);
    }
  }

  const percent =
    state && state.total > 0 ? Math.round((state.indexed / state.total) * 100) : 0;

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-xl border border-night-100 bg-mist/50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium text-night-700">
              <Database className="h-4 w-4 text-night-400" aria-hidden />
              Base de connaissances du tuteur
            </p>
            <p className="mt-1 text-xs text-night-400">
              Le tuteur ne répond qu'à partir du contenu des leçons indexées. Sans index, il reste
              muet plutôt que d'inventer. Chaque clic traite 3 cours ; relancez jusqu'à 100 %.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              loading={loading}
              onClick={() => index(false)}
              disabled={!state?.configured || (state?.pending ?? 0) === 0}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden />
              )}
              Indexer les documents en attente
            </Button>
            <Button size="sm" variant="ghost" onClick={() => index(true)} disabled={!state?.configured || loading}>
              Tout réindexer
            </Button>
          </div>
        </div>

        {state && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-night-500">
              <span>
                {state.indexed} / {state.total} documents indexés · {state.chunks} passages en base
              </span>
              <span className="font-semibold text-night-700">{percent} %</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-night-100">
              <div
                className="h-full rounded-full bg-electric-500 transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            {!state.configured && (
              <p className="text-xs text-gold-800">
                Clé IA absente : l'indexation est désactivée (aucun vecteur ne peut être calculé).
              </p>
            )}
            {state.pending > 0 && state.configured && (
              <p className="text-xs text-night-400">
                {state.pending} cours encore en attente. Cliquez à nouveau sur « Indexer » : chaque
                clic traite 3 cours, puis affiche le reste.
              </p>
            )}
          </div>
        )}
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {run && (
        <div className="rounded-xl border border-night-100 bg-white p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-night-700">
            <BookOpenCheck className="h-4 w-4 text-night-400" aria-hidden />
            Résultat : {run.succeeded} réussi(s), {run.failed} échec(s), {run.remaining} restant(s)
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {run.results.map((row, position) => (
              <li
                key={`${row.title}-${position}`}
                className={row.ok ? "text-night-500" : "text-red-600"}
              >
                {row.ok ? "✔" : "✘"} {row.title}
                {row.ok ? ` — ${row.chunks} passage(s)` : ` — ${row.error}`}
              </li>
            ))}
          </ul>
          {run.message && <p className="mt-2 text-xs text-night-400">{run.message}</p>}
          {run.remaining > 0 && (
            <p className="mt-2 text-xs text-night-400">
              Relancez « Indexer » pour traiter la suite ({run.remaining} restant).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
