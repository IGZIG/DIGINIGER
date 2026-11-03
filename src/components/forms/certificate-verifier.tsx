"use client";

import { useState, useTransition } from "react";
import { Search, ShieldCheck, ShieldX, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/fields";
import { Alert } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import type { CertificateVerification } from "@/types/database";

/**
 * Vérification publique d'un certificat.
 * Appelle la fonction RPC verify_certificate() : la table certificates n'est
 * pas exposée à anon, seuls des champs non sensibles sont renvoyés.
 */
export function CertificateVerifier({ initialSerial }: { initialSerial?: string }) {
  const [serial, setSerial] = useState(initialSerial ?? "");
  const [result, setResult] = useState<CertificateVerification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function verify(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);

    const value = serial.trim().toUpperCase();
    if (!/^DIGI-\d{4}-[A-Z0-9]{7}$/.test(value)) {
      setError("Format attendu : DIGI-2026-ABC1234");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("verify_certificate", {
        p_serial: value,
      });

      if (rpcError) {
        setError("Vérification impossible pour le moment. Réessayez.");
        return;
      }

      const payload = data as CertificateVerification;
      if (!payload?.found) {
        setError("Aucun certificat ne correspond à ce numéro.");
        return;
      }
      setResult(payload);
    });
  }

  return (
    <div>
      <form onSubmit={verify} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label htmlFor="serial" required>Numéro de certificat</Label>
          <Input
            id="serial"
            value={serial}
            onChange={(event) => setSerial(event.target.value)}
            placeholder="DIGI-2026-A1B2C3D"
            className="font-mono uppercase"
            autoComplete="off"
            aria-describedby="serial-help"
          />
          <p id="serial-help" className="mt-1.5 text-xs text-night-300">
            Le numéro figure sur le certificat PDF, sous le nom de l&apos;apprenant.
          </p>
        </div>
        <Button type="submit" loading={pending} size="lg">
          <Search className="h-4 w-4" aria-hidden />
          Vérifier
        </Button>
      </form>

      {error && (
        <div className="mt-6">
          <Alert tone="error" title="Certificat non trouvé">{error}</Alert>
        </div>
      )}

      {result && (
        <article className="mt-6 overflow-hidden rounded-3xl border border-night-100 bg-white shadow-card">
          <div
            className={
              result.is_valid
                ? "flex items-center gap-2 border-b border-emerald-100 bg-emerald-50 px-6 py-3 text-sm font-semibold text-emerald-800"
                : "flex items-center gap-2 border-b border-red-100 bg-red-50 px-6 py-3 text-sm font-semibold text-red-800"
            }
          >
            {result.is_valid ? (
              <>
                <ShieldCheck className="h-4 w-4" aria-hidden />
                Certificat authentique et valide
              </>
            ) : (
              <>
                <ShieldX className="h-4 w-4" aria-hidden />
                Certificat révoqué
              </>
            )}
          </div>

          <div className="p-6 sm:p-8">
            <Award className="h-8 w-8 text-gold-500" aria-hidden />
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                { label: "Apprenant", value: result.student_name },
                { label: "Formation", value: result.course_title },
                { label: "Date d'obtention", value: formatDate(result.issued_at) },
                { label: "Numéro", value: result.serial },
                {
                  label: "Score moyen",
                  value: result.score != null ? `${result.score}/100` : "Non applicable",
                },
              ].map((row) => (
                <div key={row.label}>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-night-300">
                    {row.label}
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-night-800">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </article>
      )}
    </div>
  );
}
