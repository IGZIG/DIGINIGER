import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, getDictionary, type Locale } from "./dictionaries";

/** Locale courante, lue dans le cookie posé par le sélecteur de langue. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Dictionnaire de la locale courante (Server Components). */
export async function getT() {
  const locale = await getLocale();
  return { locale, t: getDictionary(locale) };
}
