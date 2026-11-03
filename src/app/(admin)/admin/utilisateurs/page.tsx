import type { Metadata } from "next";
import { Users } from "lucide-react";
import { Avatar, EmptyState } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { RoleSelect } from "@/components/dashboard/admin-actions";
import { requireRole } from "@/lib/auth";
import { listProfilesForAdmin } from "@/lib/queries";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Utilisateurs (admin)" };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; q?: string }>;
}) {
  const admin = await requireRole(["admin"], "/admin/utilisateurs");
  const { role, q } = await searchParams;
  const all = await listProfilesForAdmin();

  const filtered = all.filter((profile) => {
    if (role && profile.role !== role) return false;
    if (q) {
      const needle = q.toLowerCase();
      return (
        (profile.full_name ?? "").toLowerCase().includes(needle) ||
        (profile.email ?? "").toLowerCase().includes(needle)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Utilisateurs ({filtered.length})</h2>
          <p className="text-sm text-night-400">
            Les rôles déterminent les droits d&apos;accès. La modification est journalisée.
          </p>
        </div>
        <form className="flex gap-2" action="/admin/utilisateurs">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Rechercher un nom ou un email"
            aria-label="Rechercher un utilisateur"
            className="w-56 rounded-xl border border-night-200 px-3 py-2 text-sm focus:border-electric-500 focus:outline-none focus:ring-2 focus:ring-electric-100"
          />
          {role && <input type="hidden" name="role" value={role} />}
          <button
            type="submit"
            className="rounded-xl bg-night-800 px-3.5 py-2 text-sm font-medium text-white hover:bg-night-700"
          >
            Chercher
          </button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { value: "", label: "Tous" },
          { value: "student", label: "Apprenants" },
          { value: "instructor", label: "Formateurs" },
          { value: "admin", label: "Administrateurs" },
        ].map((filter) => (
          <a
            key={filter.value}
            href={filter.value ? `/admin/utilisateurs?role=${filter.value}` : "/admin/utilisateurs"}
            className={
              (role ?? "") === filter.value
                ? "rounded-full bg-night-800 px-3.5 py-1.5 text-xs font-medium text-white"
                : "rounded-full border border-night-200 px-3.5 py-1.5 text-xs font-medium text-night-600 hover:bg-night-50"
            }
          >
            {filter.label}
          </a>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="Aucun utilisateur"
          description="Aucun compte ne correspond à ces critères."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-night-100 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-mist text-left text-xs uppercase tracking-wider text-night-400">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Utilisateur</th>
                <th scope="col" className="px-4 py-3 font-medium">Inscrit le</th>
                <th scope="col" className="px-4 py-3 font-medium">Vérifié</th>
                <th scope="col" className="px-4 py-3 font-medium">Rôle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-night-100">
              {filtered.map((profile) => (
                <tr key={profile.id}>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <Avatar name={profile.full_name || profile.email || "Utilisateur"} size={30} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-night-800">
                          {profile.full_name || "Sans nom"}
                        </span>
                        <span className="block truncate text-xs text-night-400">{profile.email}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-night-400">{formatDate(profile.created_at)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={profile.is_verified ? "green" : "gold"}>
                      {profile.is_verified ? "Oui" : "Non"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <RoleSelect
                      userId={profile.id}
                      currentRole={profile.role}
                      disabled={profile.id === admin.authId}
                    />
                    {profile.id === admin.authId && (
                      <p className="mt-1 text-[11px] text-night-300">Votre compte (verrouillé)</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
