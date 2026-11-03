import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { ApplicationActions } from "@/components/dashboard/admin-actions";
import { requireRole } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Demandes (admin)" };
export const dynamic = "force-dynamic";

export default async function AdminApplicationsPage() {
  await requireRole(["admin"], "/admin/demandes");
  const supabase = await createServerSupabase();

  const { data: applications } = await supabase
    .from("application_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = applications ?? [];

  const labels: Record<string, string> = {
    contact: "Contact",
    instructor: "Candidature formateur",
    enterprise: "Entreprise",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Demandes entrantes ({rows.length})</h2>
        <p className="text-sm text-night-400">
          Contacts, candidatures formateurs et demandes entreprises, enregistrés depuis le site public.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-5 w-5" />}
          title="Aucune demande"
          description="Les messages déposés via les formulaires du site apparaîtront ici."
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((application) => (
            <li key={application.id} className="rounded-2xl border border-night-100 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="electric">{labels[application.kind] ?? application.kind}</Badge>
                    <Badge
                      tone={
                        application.status === "accepted"
                          ? "green"
                          : application.status === "rejected"
                            ? "red"
                            : application.status === "reviewing"
                              ? "gold"
                              : "neutral"
                      }
                    >
                      {application.status === "new"
                        ? "Nouvelle"
                        : application.status === "reviewing"
                          ? "En cours"
                          : application.status === "accepted"
                            ? "Acceptée"
                            : "Refusée"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm font-medium text-night-800">
                    {application.full_name}
                    {application.organisation ? ` — ${application.organisation}` : ""}
                  </p>
                  <p className="text-xs text-night-400">
                    {application.email}
                    {application.phone ? ` · ${application.phone}` : ""} ·{" "}
                    {formatDateTime(application.created_at)}
                  </p>
                  <p className="mt-2 whitespace-pre-line rounded-xl bg-mist px-3 py-2 text-sm text-night-600">
                    {String((application.payload as { message?: string })?.message ?? application.subject ?? "—")}
                  </p>
                </div>
                <ApplicationActions applicationId={application.id} status={application.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
