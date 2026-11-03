import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { EmptyState } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { GenerationReview } from "@/components/dashboard/generation-review";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAiConfigured } from "@/lib/ai/tutor";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Contenus IA (admin)" };
export const dynamic = "force-dynamic";

interface GenerationRow {
  id: string;
  status: string;
  model: string | null;
  tokens: number | null;
  error: string | null;
  created_at: string;
  prompt: { title?: string; school?: string; level?: string } | null;
  result: { title?: string; summary?: string; modules?: unknown[] } | null;
  author: { full_name?: string; email?: string } | null;
}

export default async function AdminAiContentPage() {
  await requireRole(["admin"], "/admin/contenus-ia");
  const adminClient = createAdminClient();

  const { data } = await adminClient
    .from("course_generations")
    .select("id, status, model, tokens, error, created_at, prompt, result, author:profiles!course_generations_created_by_fkey(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (data ?? []) as unknown as GenerationRow[];
  const configured = isAiConfigured();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Contenus générés ({rows.length})</h2>
        <p className="text-sm text-night-400">
          Tout contenu produit par l&apos;IA reste à l&apos;état de brouillon jusqu&apos;à validation
          humaine. Cette page permet de relire et d&apos;écarter les générations.
        </p>
      </div>

      <div
        className={`rounded-2xl border p-4 text-sm ${
          configured ? "border-emerald-100 bg-emerald-50/60 text-emerald-900" : "border-gold-100 bg-gold-50 text-gold-900"
        }`}
      >
        <p className="font-semibold">Moteur IA : {configured ? "configuré" : "non configuré"}</p>
        <p className="mt-1 leading-relaxed">
          {configured
            ? "Les générations sont réelles : chaque appel est journalisé avec le nombre de tokens consommés."
            : "Aucune variable OPENAI_API_KEY n'est définie : le générateur répond « non configuré » et n'invente aucun contenu. Les entrées affichées ci-dessous proviennent uniquement de tentatives réelles."}
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title="Aucune génération"
          description="Les brouillons créés depuis l'espace formateur apparaîtront ici pour relecture."
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-2xl border border-night-100 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-night-800">
                      {row.prompt?.title ?? row.result?.title ?? "Génération sans titre"}
                    </h3>
                    <Badge
                      tone={
                        row.status === "ready"
                          ? "green"
                          : row.status === "rejected"
                            ? "red"
                            : row.status === "failed"
                              ? "red"
                              : "gold"
                      }
                    >
                      {row.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-night-400">
                    {row.author?.full_name ?? row.author?.email ?? "Auteur inconnu"} ·{" "}
                    {formatDateTime(row.created_at)}
                    {row.model ? ` · ${row.model}` : ""}
                    {row.tokens ? ` · ${row.tokens} tokens` : ""}
                  </p>
                  {row.result?.summary && (
                    <p className="mt-2 line-clamp-3 rounded-xl bg-mist px-3 py-2 text-sm text-night-600">
                      {row.result.summary}
                    </p>
                  )}
                  {row.error && (
                    <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                      Échec : {row.error}
                    </p>
                  )}
                </div>
                {row.result && row.status !== "rejected" && row.status !== "ready" && (
                  <GenerationReview generationId={row.id} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
