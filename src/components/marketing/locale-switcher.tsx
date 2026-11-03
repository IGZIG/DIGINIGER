"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

/**
 * Bascule FR/EN.
 * La langue est stockée dans un cookie (pas dans l'URL) : les pages restent
 * indexables sous une seule adresse, et le serveur rend immédiatement la
 * bonne langue au prochain rendu.
 */
export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function set(next: Locale) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-night-200 p-0.5"
      role="group"
      aria-label="Langue / Language"
    >
      <Languages className="ml-1.5 h-3.5 w-3.5 text-night-300" aria-hidden />
      {(["fr", "en"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => set(code)}
          disabled={pending}
          aria-pressed={locale === code}
          className={cn(
            "rounded-full px-2 py-1 text-[11px] font-semibold uppercase transition-colors",
            locale === code
              ? "bg-night-800 text-white"
              : "text-night-400 hover:text-night-700",
          )}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
