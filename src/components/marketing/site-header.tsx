"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X, LayoutDashboard, ChevronDown } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LocaleSwitcher } from "@/components/marketing/locale-switcher";
import { getDictionary, type Locale } from "@/lib/i18n/dictionaries";
import type { UserRole } from "@/types/database";

/** Construit la navigation dans la langue courante (aucune clé en dur). */
function buildNav(locale: Locale) {
  const t = getDictionary(locale).nav;
  return {
    main: [
      { href: "/formations", label: t.courses },
      { href: "/ecoles", label: t.schools },
      { href: "/formateurs", label: t.instructors },
      { href: "/entreprises", label: t.business },
      { href: "/tarifs", label: t.pricing },
    ],
    secondary: [
      { href: "/a-propos", label: t.about },
      { href: "/contact", label: t.contact },
      { href: "/verifier-certificat", label: t.verify },
    ],
  };
}

export function SiteHeader({
  user,
  locale,
}: {
  user: { name: string; role: UserRole } | null;
  locale: Locale;
}) {
  const t = getDictionary(locale).nav;
  const { main: MAIN_NAV, secondary: SECONDARY_NAV } = buildNav(locale);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b transition-all duration-300",
        scrolled
          ? "border-night-100 bg-white/90 backdrop-blur-md shadow-soft"
          : "border-transparent bg-white",
      )}
    >
      <div className="container-page flex h-16 items-center justify-between gap-4 lg:h-[72px]">
        <Logo />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigation principale">
          {MAIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "bg-electric-50 text-electric-700"
                  : "text-night-500 hover:bg-night-50 hover:text-night-800",
              )}
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}

          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((value) => !value)}
              className="flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-medium text-night-500 transition-colors hover:bg-night-50 hover:text-night-800"
              aria-expanded={moreOpen}
              aria-haspopup="true"
            >
              {locale === "en" ? "More" : "Plus"}
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform", moreOpen && "rotate-180")}
                aria-hidden
              />
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-2xl border border-night-100 bg-white p-1.5 shadow-card">
                {SECONDARY_NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded-xl px-3 py-2.5 text-sm text-night-600 transition-colors hover:bg-night-50 hover:text-night-800"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {user ? (
            <>
              <LocaleSwitcher locale={locale} />
              <ButtonLink
                href={user.role === "student" ? "/app" : user.role === "instructor" ? "/formateur" : "/admin"}
                variant="secondary"
                size="sm"
              >
                <LayoutDashboard className="h-4 w-4" aria-hidden />
                {t.dashboard}
              </ButtonLink>
            </>
          ) : (
            <>
              <LocaleSwitcher locale={locale} />
              <Link
                href="/connexion"
                className="rounded-full px-4 py-2 text-sm font-medium text-night-600 transition-colors hover:bg-night-50 hover:text-night-800"
              >
                {t.login}
              </Link>
              <ButtonLink href="/inscription" size="sm">
                {locale === "en" ? "Get started free" : "Commencer gratuitement"}
              </ButtonLink>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-night-200 text-night-700 lg:hidden"
          aria-expanded={open}
          aria-controls="menu-mobile"
          aria-label={open ? t.closeMenu : t.openMenu}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div id="menu-mobile" className="border-t border-night-100 bg-white lg:hidden">
          <nav className="container-page flex flex-col gap-1 py-4" aria-label="Navigation mobile">
            {[...MAIN_NAV, ...SECONDARY_NAV].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-xl px-3 py-3 text-sm font-medium",
                  isActive(item.href) ? "bg-electric-50 text-electric-700" : "text-night-600",
                )}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-night-100 pt-4">
              <LocaleSwitcher locale={locale} />
              {user ? (
                <ButtonLink
                  href={user.role === "student" ? "/app" : user.role === "instructor" ? "/formateur" : "/admin"}
                  size="md"
                >
                  {t.dashboard}
                </ButtonLink>
              ) : (
                <>
                  <ButtonLink href="/connexion" variant="outline" size="md">
                    {t.login}
                  </ButtonLink>
                  <ButtonLink href="/inscription" size="md">
                    {locale === "en" ? "Get started free" : "Commencer gratuitement"}
                  </ButtonLink>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
