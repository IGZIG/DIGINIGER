import { DashboardShell, type NavItem } from "@/components/dashboard/sidebar";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Barrière serveur stricte : rôle admin uniquement.
  const user = await requireRole(["admin"], "/admin");

  const items: NavItem[] = [
    { href: "/admin", label: "Tableau de bord", icon: "dashboard" },
    { href: "/admin/formations", label: "Formations", icon: "courses" },
    { href: "/admin/utilisateurs", label: "Utilisateurs", icon: "learners" },
    { href: "/admin/demandes", label: "Demandes", icon: "requests" },
    { href: "/admin/paiements", label: "Paiements", icon: "payments" },
    { href: "/admin/contenus-ia", label: "Contenus IA", icon: "ai" },
    { href: "/admin/certificats", label: "Certificats", icon: "certificates" },
    { href: "/admin/parametres", label: "Paramètres", icon: "settings" },
    { href: "/formateur", label: "Espace formateur", icon: "instructor" },
  ];

  return (
    <DashboardShell
      items={items}
      title="Administration DIGINIGER"
      subtitle="Pilotage de la plateforme, validation éditoriale et suivi financier."
      user={{
        name: user.profile?.full_name || user.email || "Administrateur",
        email: user.email ?? "",
        role: user.profile?.role ?? "admin",
      }}
    >
      {children}
    </DashboardShell>
  );
}
