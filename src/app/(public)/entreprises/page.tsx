import type { Metadata } from "next";
import { Building2, BarChart3, Users, ShieldCheck, CheckCircle2 } from "lucide-react";
import { SectionTitle } from "@/components/ui/primitives";
import { ContactForm } from "@/components/forms/contact-form";

export const metadata: Metadata = {
  title: "Solutions entreprises",
  description:
    "Formation des équipes, académie interne et suivi des compétences avec DIGINIGER.",
};

const SOLUTIONS = [
  { icon: Building2, title: "Académie interne clé en main", text: "Votre propre académie à votre marque, hébergée et administrée par DIGINIGER." },
  { icon: Users, title: "Parcours métiers", text: "Des modules co-construits avec vos référents métier et vos procédures internes." },
  { icon: BarChart3, title: "Suivi et reporting", text: "Indicateurs d'assiduité, de progression et de satisfaction, exportables." },
  { icon: ShieldCheck, title: "Cadre contractuel", text: "Convention de formation, devis en FCFA, facturation et attestations personnalisées." },
];

const STEPS = [
  "Diagnostic des besoins de compétences",
  "Conception du parcours et validation métier",
  "Déploiement et accompagnement des équipes",
  "Mesure des résultats et ajustements",
];

export default function EnterprisePage() {
  return (
    <div>
      <section className="border-b border-night-100 bg-mist/60">
        <div className="container-page py-16">
          <SectionTitle
            eyebrow="Entreprises & organisations"
            title="Développez les compétences de vos équipes, avec des résultats mesurables."
            description="Banques, télécoms, coopératives, ONG, institutions publiques : DIGINIGER conçoit des parcours adaptés à vos métiers, avec un suivi de progression et des attestations."
          />
          <dl className="mt-8 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { value: "500+", label: "collaborateurs formés" },
              { value: "32", label: "organisations partenaires" },
              { value: "87 %", label: "taux de complétion" },
              { value: "12", label: "secteurs couverts" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-night-100 bg-white p-4">
                <dt className="text-xs uppercase tracking-wider text-night-300">{stat.label}</dt>
                <dd className="mt-1 font-display text-xl font-bold">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="container-page py-14">
        <div className="grid gap-4 sm:grid-cols-2">
          {SOLUTIONS.map((solution) => (
            <div key={solution.title} className="rounded-3xl border border-night-100 bg-white p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-electric-50 text-electric-600">
                <solution.icon className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-4 text-base font-semibold">{solution.title}</h2>
              <p className="mt-1.5 text-sm text-night-500">{solution.text}</p>
            </div>
          ))}
        </div>

        <section className="mt-12 rounded-3xl bg-night-800 p-8">
          <h2 className="font-display text-xl font-semibold text-white">Notre méthode en 4 étapes</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <span className="font-display text-sm font-bold text-gold-400">0{index + 1}</span>
                <p className="mt-2 text-sm text-white/70">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="text-xl font-semibold">Ce que vous obtenez</h2>
            <ul className="mt-4 space-y-2.5 text-sm text-night-500">
              {[
                "Un espace dédié avec votre marque",
                "Des parcours par métier et par niveau",
                "Un tableau de bord de suivi pour les RH",
                "Des attestations nominatives et vérifiables",
                "Un interlocuteur dédié",
                "Une facturation conforme, en FCFA",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <section className="rounded-3xl border border-night-100 bg-white p-6 shadow-soft sm:p-8">
            <h2 className="text-lg font-semibold">Demander une proposition</h2>
            <p className="mt-1 text-sm text-night-400">
              Indiquez votre organisation et vos besoins : nous revenons vers vous avec un devis.
            </p>
            <div className="mt-6">
              <ContactForm
                kind="enterprise"
                submitLabel="Demander une proposition"
                showOrganisation
                showSubject={false}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
