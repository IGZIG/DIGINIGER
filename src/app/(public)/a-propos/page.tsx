import type { Metadata } from "next";
import { Target, Telescope, ShieldCheck, MapPin, Sparkles, HeartHandshake } from "lucide-react";
import { SectionTitle } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "À propos",
  description:
    "DIGINIGER : une académie numérique née au Niger, pensée pour l'Afrique de l'Ouest.",
};

const VALUES = [
  { icon: ShieldCheck, title: "Exigence", text: "Des contenus vérifiés, des formateurs praticiens, des promesses tenues." },
  { icon: MapPin, title: "Ancrage local", text: "Des exemples, des prix et des formats adaptés aux réalités de la région." },
  { icon: Sparkles, title: "Accessibilité", text: "Mobilité, faible bande passante, interface simple et rapide." },
  { icon: HeartHandshake, title: "Transparence", text: "Prix clairs en FCFA, revenus formateurs lisibles, données protégées." },
];

const TIMELINE = [
  { year: "2023", title: "Naissance du projet à Niamey", text: "Un groupe de formateurs et d'ingénieurs dessine la première maquette de la plateforme." },
  { year: "2024", title: "Premières écoles en pilote", text: "AI & Technology et Business & Entrepreneurship ouvrent leurs premières cohortes." },
  { year: "2025", title: "Tuteur IA et marketplace formateurs", text: "Lancement de l'accompagnement intelligent et du programme formateurs." },
  { year: "2026", title: "Extension régionale", text: "Déploiement progressif au Mali, Burkina Faso, Sénégal et Côte d'Ivoire." },
];

export default function AboutPage() {
  return (
    <div>
      <section className="border-b border-night-100 bg-mist/60">
        <div className="container-page py-16">
          <SectionTitle
            eyebrow="À propos"
            title="Une académie numérique née au Niger, pensée pour l'Afrique de l'Ouest."
            description="Notre conviction : l'accès à une formation professionnelle de qualité change des trajectoires. Nous construisons l'infrastructure qui rend cela possible, à grande échelle et à un prix juste."
          />
        </div>
      </section>

      <div className="container-page py-14">
        <div className="grid gap-6 md:grid-cols-2">
          <article className="rounded-3xl border border-night-100 bg-white p-7">
            <Target className="h-6 w-6 text-electric-600" aria-hidden />
            <h2 className="mt-4 text-xl font-semibold">Notre mission</h2>
            <p className="mt-2 text-sm leading-relaxed text-night-500">
              Rendre la formation professionnelle accessible, pratique et reconnue dans toute la
              sous-région, en combinant l&apos;expertise des formateurs locaux et la puissance
              d&apos;outils numériques intelligents.
            </p>
          </article>
          <article className="rounded-3xl border border-night-100 bg-white p-7">
            <Telescope className="h-6 w-6 text-gold-500" aria-hidden />
            <h2 className="mt-4 text-xl font-semibold">Notre vision</h2>
            <p className="mt-2 text-sm leading-relaxed text-night-500">
              Devenir la référence EdTech d&apos;Afrique de l&apos;Ouest pour les compétences
              numériques, entrepreneuriales, agricoles, financières, commerciales et techniques.
            </p>
          </article>
        </div>

        <section className="mt-14">
          <h2 className="text-xl font-semibold">Nos valeurs</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((value) => (
              <div key={value.title} className="rounded-2xl border border-night-100 bg-white p-5">
                <value.icon className="h-5 w-5 text-electric-600" aria-hidden />
                <h3 className="mt-3 text-sm font-semibold">{value.title}</h3>
                <p className="mt-1 text-sm text-night-400">{value.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-semibold">Notre parcours</h2>
          <ol className="mt-6 space-y-4 border-l-2 border-night-100 pl-6">
            {TIMELINE.map((item) => (
              <li key={item.year} className="relative">
                <span className="absolute -left-[31px] flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-electric-500" aria-hidden />
                <p className="font-display text-sm font-bold text-electric-600">{item.year}</p>
                <p className="mt-0.5 font-semibold text-night-800">{item.title}</p>
                <p className="mt-0.5 text-sm text-night-400">{item.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-14 rounded-3xl bg-night-800 p-8 text-center lg:p-12">
          <h2 className="font-display text-2xl font-semibold text-white">
            Rejoignez la communauté DIGINIGER
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/60">
            Apprenant, formateur ou entreprise : il y a une place pour vous dans l&apos;académie.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/inscription" variant="gold">Créer mon compte</ButtonLink>
            <ButtonLink href="/formateurs" variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10">
              Devenir formateur
            </ButtonLink>
          </div>
        </section>
      </div>
    </div>
  );
}
