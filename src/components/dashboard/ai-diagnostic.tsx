"use client";

import { useState } from "react";
import { Activity, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";

interface Diagnostic {
  configured: boolean;
  provider: string;
  baseURLHost: string | null;
  chatModel: string;
  embeddingModel: string;
  embeddingDimensions: number;
  probe: {
    chat: { ok: boolean; model?: string; error?: string };
    embeddings: { ok: boolean; model?: string; dimensions?: number; error?: string };
  } | null;
}

/**
 * Bouton de contrôle réel du moteur IA.
 * Il appelle le fournisseur pour de vrai : on ne se contente pas de la
 * présence d'une variable d'environnement.
 */
export function AiDiagnostic() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Diagnostic | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/ai/diagnostic", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error === "FORBIDDEN" ? "Réservé aux administrateurs." : "Contrôle impossible.");
        return;
      }
      setResult(payload as Diagnostic);
    } catch {
      setError("Le contrôle n'a pas abouti (réseau).");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-night-100 bg-mist/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-night-700">Contrôle réel du moteur</p>
          <p className="text-xs text-night-400">
            Envoie une complétion et un embedding de test, puis vérifie la dimension des vecteurs.
          </p>
        </div>
        <Button size="sm" variant="outline" loading={loading} onClick={run}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Activity className="h-4 w-4" aria-hidden />}
          Lancer le diagnostic
        </Button>
      </div>

      {error && <div className="mt-3"><Alert tone="error">{error}</Alert></div>}

      {result && (
        <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <div className="rounded-lg bg-white px-3 py-2">
            <dt className="text-night-400">Complétion</dt>
            <dd className={result.probe?.chat.ok ? "font-semibold text-emerald-700" : "font-semibold text-red-600"}>
              {result.probe?.chat.ok ? `OK — ${result.probe.chat.model ?? result.chatModel}` : (result.probe?.chat.error ?? "non testé")}
            </dd>
          </div>
          <div className="rounded-lg bg-white px-3 py-2">
            <dt className="text-night-400">Embeddings</dt>
            <dd className={result.probe?.embeddings.ok ? "font-semibold text-emerald-700" : "font-semibold text-red-600"}>
              {result.probe?.embeddings.ok
                ? `OK — ${result.probe.embeddings.dimensions} dimensions`
                : (result.probe?.embeddings.error ?? "non testé")}
            </dd>
          </div>
          <div className="rounded-lg bg-white px-3 py-2">
            <dt className="text-night-400">Fournisseur</dt>
            <dd className="font-mono text-night-700">
              {result.provider}
              {result.baseURLHost ? ` · ${result.baseURLHost}` : ""}
            </dd>
          </div>
          <div className="rounded-lg bg-white px-3 py-2">
            <dt className="text-night-400">Modèle d'embedding</dt>
            <dd className="font-mono text-night-700">{result.embeddingModel}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
