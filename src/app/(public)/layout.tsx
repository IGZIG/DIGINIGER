import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/server";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        user={
          user
            ? { name: user.profile?.full_name ?? "Mon compte", role: user.profile?.role ?? "student" }
            : null
        }
        locale={locale}
      />
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-night-800 focus:px-4 focus:py-2 focus:text-white"
      >
        Aller au contenu
      </a>
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
