"use client";

import { useState } from "react";
import { Copy, Loader2, PlugZap, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";

interface Diagnostic {
  configured: boolean;
  vendor: string;
  mode?: string;
  apiHost?: string;
  notifyUrl?: string;
  missing?: string[];
  reachable: boolean;
  httpStatus?: number;
  providerCode?: string | null;
  providerMessage?: string | null;
  message: string;
}

/**
 * Vérification réelle du fournisseur Mobile Money, depuis l'administration.
 * Ne crée aucune facture et ne déplace aucun argent : interroge une référence
 * inexistante pour savoir si les clés sont acceptées. Affiche aussi l'adresse
 * de notification à déclarer chez le fournisseur, avec un bouton de copie.
 */
export function PaymentDiagnostic() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Diagnostic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      const response = await fetch("/api/admin/payments/diagnostic", { cache: "no-store" });
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

  async function copyNotifyUrl() {
    if (!result?.notifyUrl) return;
    try {
      await navigator.clipboard.writeText(result.notifyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-night-100 bg-mist/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-night-700">
            <ShieldCheck className="h-4 w-4 text-night-400" aria-hidden />
            Vérifier les clés du fournisseur
          </p>
          <p className="mt-1 text-xs text-night-400">
            Contrôle réel auprès du fournisseur. Aucune facture créée, aucun argent déplacé.
          </p>
        </div>
        <Button size="sm" variant="outline" loading={loading} onClick={run}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <PlugZap className="h-4 w-4" aria-hidden />
          )}
          Tester la connexion
        </Button>
      </div>

      {error && (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {result && (
        <div className="mt-3 space-y-3 rounded-lg bg-white p-3 text-xs">
          <p className="text-sm font-medium">
            {result.reachable ? (
              <span className="text-emerald-700">✔ Fournisseur joignable et clés acceptées</span>
            ) : result.configured ? (
              <span className="text-red-600">✘ Connexion refusée</span>
            ) : (
              <span className="text-gold-800">⛔ Pas encore configuré</span>
            )}
          </p>

          <p className="leading-relaxed text-night-600">{result.message}</p>

          <dl className="grid gap-1 text-night-500 sm:grid-cols-2">
            <div>
              <dt className="inline text-night-400">Fournisseur : </dt>
              <dd className="inline font-medium text-night-700">{result.vendor}</dd>
            </div>
            {result.mode && (
              <div>
                <dt className="inline text-night-400">Mode : </dt>
                <dd className="inline font-medium text-night-700">
                  {result.mode === "live" ? "réel (live)" : "test (bac à sable)"}
                </dd>
              </div>
            )}
            {result.apiHost && (
              <div>
                <dt className="inline text-night-400">Serveur : </dt>
                <dd className="inline font-medium text-night-700">{result.apiHost}</dd>
              </div>
            )}
            {typeof result.httpStatus === "number" && (
              <div>
                <dt className="inline text-night-400">Réponse HTTP : </dt>
                <dd className="inline font-medium text-night-700">{result.httpStatus}</dd>
              </div>
            )}
          </dl>

          {result.notifyUrl && (
            <div className="rounded-lg border border-night-100 p-3">
              <p className="text-night-500">
                Adresse de notification à déclarer chez le fournisseur (IPN / callback) :
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <code className="break-all rounded bg-night-50 px-2 py-1 text-[11px] text-night-700">
                  {result.notifyUrl}
                </code>
                <Button size="sm" variant="ghost" onClick={copyNotifyUrl}>
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  {copied ? "Copié" : "Copier"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
