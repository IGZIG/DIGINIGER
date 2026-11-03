import Link from "next/link";
import { Facebook, Linkedin, Instagram, Youtube, Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/ui/logo";

const COLUMNS = [
  {
    title: "Plateforme",
    links: [
      { href: "/formations", label: "Catalogue des formations" },
      { href: "/ecoles", label: "Nos six écoles" },
      { href: "/tarifs", label: "Tarifs et abonnements" },
      { href: "/tuteur-ia", label: "Tuteur IA" },
    ],
  },
  {
    title: "Apprendre",
    links: [
      { href: "/inscription", label: "Créer un compte" },
      { href: "/connexion", label: "Se connecter" },
      { href: "/verifier-certificat", label: "Vérifier un certificat" },
      { href: "/contact", label: "Aide et contact" },
    ],
  },
  {
    title: "Entreprise",
    links: [
      { href: "/entreprises", label: "Solutions entreprises" },
      { href: "/formateurs", label: "Devenir formateur" },
      { href: "/a-propos", label: "À propos de DIGINIGER" },
      { href: "/contact", label: "Nous écrire" },
    ],
  },
  {
    title: "Légal",
    links: [
      { href: "/conditions-utilisation", label: "Conditions d'utilisation" },
      { href: "/confidentialite", label: "Politique de confidentialité" },
      { href: "/mentions-legales", label: "Mentions légales" },
    ],
  },
];

const SOCIALS = [
  { href: "https://facebook.com", label: "Facebook", Icon: Facebook },
  { href: "https://linkedin.com", label: "LinkedIn", Icon: Linkedin },
  { href: "https://instagram.com", label: "Instagram", Icon: Instagram },
  { href: "https://youtube.com", label: "YouTube", Icon: Youtube },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-night-900 text-white/70">
      <div className="container-page grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <Logo inverted />
          <p className="mt-5 max-w-xs text-sm leading-relaxed">
            L&apos;académie numérique intelligente du Niger et de l&apos;Afrique de l&apos;Ouest.
            Des compétences concrètes, des formateurs experts et un tuteur IA à vos côtés.
          </p>
          <div className="mt-6 space-y-2.5 text-sm">
            <p className="flex items-center gap-2.5">
              <MapPin className="h-4 w-4 text-gold-500" aria-hidden />
              Avenue de l&apos;Uranium, Niamey, Niger
            </p>
            <p className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 text-gold-500" aria-hidden />
              <a href="mailto:contact@diginiger.ne" className="hover:text-white">
                contact@diginiger.ne
              </a>
            </p>
            <p className="flex items-center gap-2.5">
              <Phone className="h-4 w-4 text-gold-500" aria-hidden />
              +227 20 00 00 00
            </p>
          </div>
          <div className="mt-6 flex gap-2">
            {SOCIALS.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-white/70 transition-colors hover:bg-electric-500 hover:text-white"
              >
                <Icon className="h-4 w-4" aria-hidden />
              </a>
            ))}
          </div>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.title}>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              {column.title}
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-6 text-xs sm:flex-row">
          <p>© {new Date().getFullYear()} DIGINIGER. Tous droits réservés.</p>
          <p className="text-white/40">
            Apprendre aujourd&apos;hui. Construire le monde de demain.
          </p>
        </div>
      </div>
    </footer>
  );
}
