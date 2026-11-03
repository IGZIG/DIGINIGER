import { DashboardShell, type NavItem } from "@/components/dashboard/sidebar";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function InstructorLayout({ children }: { children: React.ReactNode }) {
  // Barrière serveur : formateur ou admin uniquement.
  const user = await requireRole(["instructor"], "/formateur");
  const isAdmin = user.profile?.role === "admin";

  const items: NavItem[] = [
    { href: "/formateur", label: "Tableau de bord", icon: "dashboard" },
    { href: "/formateur/formations", label: "Mes formations", icon: "courses" },
    { href: "/formateur/generateur", label: "Créer une formation", icon: "create" },
    { href: "/formateur/generateur#ia", label: "Assistant IA", icon: "ai" },
    { href: "/formateur/evaluations", label: "Évaluations", icon: "assessments" },
    { href: "/formateur/apprenants", label: "Apprenants", icon: "learners" },
    { href: "/formateur/revenus", label: "Revenus", icon: "revenue" },
    ...(isAdmin ? [{ href: "/admin", label: "Administration", icon: "learners" }] : []),
  ];

  return (
    <DashboardShell
      items={items}
      title="Espace formateur"
      subtitle="Créez, structurez et publiez vos parcours pédagogiques."
      user={{
        name: user.profile?.full_name || user.email || "Formateur",
        email: user.email ?? "",
        role: user.profile?.role ?? "instructor",
      }}
    >
      {children}
    </DashboardShell>
  );
}
