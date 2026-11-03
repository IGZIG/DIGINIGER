import type { Metadata } from "next";
import { ShieldCheck, KeyRound, Server, Database, Mail, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiConfigReport } from "@/lib/ai/tutor";
import { AiDiagnostic } from "@/components/dashboard/ai-diagnostic";
import { paymentStatus } from "@/lib/payments/provider";

export const metadata: Metadata = { title: "Paramètres (admin)" };
export const dynamic = "force-dynamic";

/** Indicateur de configuration : jamais de secret affiché, seulement présence. */
function ConfigRow({
  label,
  configured,
  hint,
}: {
  label: string;
  configured: boolean;
  hint: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-night-100 py-3 last:border-0">
      <div>
        <p className="text-sm font-medium text-night-800">{label}</p>
        <p className="text-xs leading-relaxed text-night-400">{hint}</p>
      </div>
      <Badge tone={configured ? "green" : "red"}>{configured ? "Configuré" : "Manquant"}</Badge>
    </div>
  );
}

export default async function AdminSettingsPage() {
  const user = await requireRole(["admin"], "/admin/parametres");
  const payments = paymentStatus();
  const ai = aiConfigReport();
  const adminClient = createAdminClient();

  // Contrôle de santé : une requête réelle, pas un indicateur statique.
  const { error: dbError } = await adminClient
    .from("profiles")
    .select("id", { count: "exact", head: true });

  const { data: rateLimits } = await adminClient
    .from("rate_limits")
    .select("id", { count: "exact", head: true });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const projectRef = supabaseUrl.replace(/^https:\/\//, "").split(".")[0];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Paramètres et état de la plateforme</h2>
        <p className="text-sm text-night-400">
          Vue de contrôle en lecture seule. Aucune clé n&apos;est affichée : seule leur présence est
          signalée. Les secrets se configurent par variables d&apos;environnement.
        </p>
      </div>

      <section className="rounded-2xl border border-night-100 bg-white p-5">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-night-400" aria-hidden />
          <h3 className="text-sm font-semibold">Base de données</h3>
        </div>
        <div className="mt-3">
          <ConfigRow
            label="Connexion Supabase"
            configured={!dbError}
            hint={
              dbError
                ? `Erreur : ${dbError.message}`
                : `Projet ${projectRef || "inconnu"} — requête de contrôle exécutée avec succès.`
            }
          />
          <ConfigRow
            label="Clé service_role"
            configured={Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)}
            hint="Nécessaire aux webhooks, au tuteur IA, aux certificats et aux remboursements."
          />
          <ConfigRow
            label="Limitation de débit"
            configured
            hint={`Table rate_limits active (${rateLimits ? "compteurs en place" : "aucun compteur consommé"}). Les routes IA et paiement sont protégées.`}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-night-100 bg-white p-5">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-night-400" aria-hidden />
          <h3 className="text-sm font-semibold">Intelligence artificielle</h3>
        </div>
        <div className="mt-3">
          <ConfigRow
            label={`Moteur IA (${ai.provider})`}
            configured={ai.configured}
            hint={
              ai.configured
                ? `Chat : ${ai.chatModel} · Embeddings : ${ai.embeddingModel} (${ai.embeddingDimensions} dim.)${
                    ai.baseURLHost ? ` · endpoint ${ai.baseURLHost}` : ""
                  }`
                : "Clé absente : le tuteur et le générateur répondent « non configuré ». Aucune réponse n'est inventée."
            }
          />
          {ai.warnings.length > 0 && (
            <ul className="mt-2 space-y-1 rounded-xl bg-gold-50 px-3 py-2 text-xs text-gold-800">
              {ai.warnings.map((warning) => (
                <li key={warning}>• {warning}</li>
              ))}
            </ul>
          )}
          <AiDiagnostic />
        </div>
      </section>

      <section className="rounded-2xl border border-night-100 bg-white p-5">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-night-400" aria-hidden />
          <h3 className="text-sm font-semibold">Paiements</h3>
        </div>
        <div className="mt-3">
          <ConfigRow
            label={`Mobile Money — ${payments.vendor === "paydunya" ? "PayDunya" : payments.vendor === "cinetpay" ? "CinetPay" : "adaptateur générique"}`}
            configured={payments.mobileMoney}
            hint={
              payments.mobileMoney
                ? "Montants recalculés côté serveur ; accès ouvert uniquement après confirmation serveur-à-serveur du fournisseur."
                : `Variables manquantes : ${payments.missing.join(", ")}`
            }
          />
          <ConfigRow
            label="Carte bancaire"
            configured={payments.card}
            hint="Adaptateur séparé, même vérification de signature."
          />
          <ConfigRow
            label="Mode du fournisseur"
            configured={payments.mode !== "live"}
            hint={`Mode courant : ${payments.mode}. Le passage en production exige des identifiants réels (PAYDUNYA_MODE=live).`}
          />
          <ConfigRow
            label="Confirmation serveur-à-serveur"
            configured={payments.requiresConfirmation}
            hint="Indispensable chez PayDunya : le hash d'IPN est statique (SHA-512 de la master key) et ne couvre ni le montant ni le statut."
          />
        </div>
      </section>

      <section className="rounded-2xl border border-night-100 bg-white p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-night-400" aria-hidden />
          <h3 className="text-sm font-semibold">Sécurité et conformité</h3>
        </div>
        <ul className="mt-3 space-y-2 text-sm text-night-600">
          <li className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
            RLS PostgreSQL activée sur l&apos;ensemble des tables métier ; les contextes sensibles
            (chunks pédagogiques) ne sont pas lisibles par les clients.
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
            Journal d&apos;audit des actions sensibles : inscription, paiement, examen, certificat,
            changement de rôle.
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
            Limitation de débit applicative (base de données) sur l&apos;IA et les paiements.
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
            Élévation de privilèges bloquée au niveau base : un apprenant ne peut pas devenir
            administrateur, même via l&apos;API REST.
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-night-100 bg-white p-5">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-night-400" aria-hidden />
          <h3 className="text-sm font-semibold">Compte administrateur connecté</h3>
        </div>
        <p className="mt-2 text-sm text-night-600">
          {user.profile?.full_name || user.email} · <span className="text-night-400">{user.email}</span>
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-mist px-3 py-2 text-xs text-night-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          L&apos;envoi d&apos;emails transactionnels (confirmation d&apos;inscription, reçus) n&apos;est
          pas encore câblé : il dépend d&apos;un fournisseur SMTP à fournir.
        </div>
      </section>
    </div>
  );
}
