"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  BookOpen,
  PenSquare,
  Sparkles,
  ClipboardList,
  Users,
  Wallet,
  Award,
  Inbox,
  CreditCard,
  Settings,
  GraduationCap,
  User,
  TrendingUp,
  FolderOpen,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

/**
 * Icônes utilisables dans la navigation.
 * On transmet un identifiant (chaîne) et non un composant : les layouts sont
 * des Server Components et React ne peut pas sérialiser une fonction vers un
 * Client Component.
 */
const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  courses: BookOpen,
  create: PenSquare,
  ai: Sparkles,
  assessments: ClipboardList,
  learners: Users,
  revenue: Wallet,
  certificates: Award,
  requests: Inbox,
  payments: CreditCard,
  settings: Settings,
  instructor: GraduationCap,
  account: User,
  progress: TrendingUp,
  documents: FolderOpen,
};

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  badge?: number;
}

/**
 * Navigation latérale des espaces connectés.
 * Affiche uniquement les entrées autorisées pour le rôle courant : la
 * sécurité réelle reste côté serveur (layout + RLS), ceci n'est que de l'UX.
 */
export function DashboardShell({
  items,
  user,
  title,
  subtitle,
  children,
}: {
  items: NavItem[];
  user: { name: string; email: string; role: string };
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || (href !== "/app" && href !== "/admin" && pathname.startsWith(`${href}/`));

  const nav = (
    <nav className="flex flex-1 flex-col gap-1" aria-label="Navigation de l'espace">
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? LayoutDashboard;
        return (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setOpen(false)}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            isActive(item.href)
              ? "bg-electric-500 text-white shadow-glow"
              : "text-white/60 hover:bg-white/5 hover:text-white",
          )}
          aria-current={isActive(item.href) ? "page" : undefined}
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden />
          <span className="flex-1">{item.label}</span>
          {typeof item.badge === "number" && item.badge > 0 && (
            <span className="rounded-full bg-gold-500 px-1.5 py-0.5 text-[10px] font-bold text-night-900">
              {item.badge}
            </span>
          )}
        </Link>
        );
      })}

      <form action="/auth/signout" method="post" className="mt-auto pt-4">
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/50 transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Se déconnecter
        </button>
      </form>
    </nav>
  );

  return (
    <div className="min-h-screen bg-mist">
      {/* Barre latérale bureau */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col bg-night-900 p-5 lg:flex">
        <div className="mb-8">
          <Logo inverted />
        </div>
        {nav}
        <div className="mt-4 rounded-2xl bg-white/5 p-3">
          <p className="truncate text-sm font-medium text-white">{user.name}</p>
          <p className="truncate text-xs text-white/40">{user.email}</p>
          <p className="mt-2 inline-flex rounded-full bg-electric-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-electric-200">
            {user.role === "admin" ? "Administrateur" : user.role === "instructor" ? "Formateur" : "Apprenant"}
          </p>
        </div>
      </aside>

      {/* En-tête mobile */}
      <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-night-100 bg-white px-4 lg:hidden">
        <Logo compact />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-night-200"
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-night-950/60"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 flex w-[280px] flex-col bg-night-900 p-5">
            <div className="mb-8 flex items-center justify-between">
              <Logo inverted />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-white/60"
                aria-label="Fermer le menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
          </div>
        </div>
      )}

      <div className="lg:pl-[264px]">
        <header className="border-b border-night-100 bg-white px-5 py-6 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <h1 className="text-2xl font-semibold">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-night-400">{subtitle}</p>}
          </div>
        </header>
        <div className="px-5 py-6 sm:px-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </div>
      </div>
    </div>
  );
}
