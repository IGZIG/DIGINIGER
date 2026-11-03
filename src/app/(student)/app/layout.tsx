import { DashboardShell, type NavItem } from "@/components/dashboard/sidebar";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  // Barrière serveur : impossible d'afficher l'espace sans session valide.
  const user = await requireUser("/app");
  const role = user.profile?.role ?? "student";

  const items: NavItem[] = [
    { href: "/app", label: "Tableau de bord", icon: "dashboard" },
    { href: "/app/mes-formations", label: "Mes formations", icon: "courses" },
    { href: "/app/catalogue", label: "Catalogue", icon: "courses" },
    { href: "/app/progression", label: "Progression", icon: "progress" },
    { href: "/app/evaluations", label: "Exercices & examens", icon: "assessments" },
    { href: "/app/certificats", label: "Certificats", icon: "certificates" },
    { href: "/app/tuteur-ia", label: "Tuteur IA", icon: "ai" },
    { href: "/app/abonnement", label: "Abonnement", icon: "payments" },
    { href: "/app/profil", label: "Profil", icon: "account" },
  ];

  return (
    <DashboardShell
      items={items}
      title="Mon espace d'apprentissage"
      user={{
        name: user.profile?.full_name || user.email || "Apprenant",
        email: user.email ?? "",
        role,
      }}
    >
      {children}
    </DashboardShell>
  );
}
