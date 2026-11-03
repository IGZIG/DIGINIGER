import type { Metadata, Viewport } from "next";
import { getT } from "@/lib/i18n/server";
import { htmlLang } from "@/lib/i18n/dictionaries";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "DIGINIGER — Apprendre aujourd'hui. Construire le monde de demain.",
    template: "%s · DIGINIGER",
  },
  description:
    "Académie numérique intelligente du Niger et de l'Afrique de l'Ouest : formations professionnelles, formateurs experts, tuteur IA et certificats vérifiables.",
  keywords: [
    "formation en ligne",
    "Niger",
    "Afrique de l'Ouest",
    "e-learning",
    "IA pédagogique",
    "certification",
  ],
  authors: [{ name: "DIGINIGER" }],
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "DIGINIGER",
    title: "DIGINIGER — Académie numérique intelligente",
    description:
      "Développez les compétences qui construiront votre avenir, avec des experts et un tuteur IA.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#101B3D",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // L'attribut lang suit la langue choisie : utile aux lecteurs d'écran et à
  // la traduction automatique du navigateur.
  const { locale } = await getT();

  return (
    <html lang={htmlLang(locale)}>
      <body>{children}</body>
    </html>
  );
}
