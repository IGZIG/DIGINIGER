import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { ShieldCheck, Sparkles, GraduationCap } from "lucide-react";

const ARGUMENTS = [
  { icon: GraduationCap, text: "6 écoles, 180 formations professionnelles" },
  { icon: Sparkles, text: "Tuteur IA disponible 24 h/24" },
  { icon: ShieldCheck, text: "Certificats vérifiables par QR code" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Colonne éditoriale (masquée sur mobile) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-night-900 p-12 lg:flex">
        <div className="pointer-events-none absolute inset-0 grid-lines opacity-30" aria-hidden />
        <div className="pointer-events-none absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-electric-500/25 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -right-16 bottom-10 h-64 w-64 rounded-full bg-gold-500/20 blur-3xl" aria-hidden />

        <div className="relative">
          <Logo inverted />
        </div>

        <div className="relative max-w-sm">
          <h2 className="font-display text-3xl font-semibold leading-tight text-white">
            Apprendre aujourd&apos;hui.
            <br />
            Construire le monde de demain.
          </h2>
          <ul className="mt-8 space-y-3.5">
            {ARGUMENTS.map((item) => (
              <li key={item.text} className="flex items-center gap-3 text-sm text-white/60">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-gold-400">
                  <item.icon className="h-4 w-4" aria-hidden />
                </span>
                {item.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/30">
          © {new Date().getFullYear()} DIGINIGER · Niamey, Niger
        </p>
      </aside>

      {/* Colonne formulaire */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between border-b border-night-100 px-5 py-4 lg:hidden">
          <Logo />
          <Link href="/" className="text-sm font-medium text-night-500">
            Retour au site
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
          {children}
        </div>
        <div className="hidden justify-center pb-8 lg:flex">
          <Link href="/" className="text-sm text-night-400 hover:text-night-600">
            ← Retour au site public
          </Link>
        </div>
      </div>
    </div>
  );
}
