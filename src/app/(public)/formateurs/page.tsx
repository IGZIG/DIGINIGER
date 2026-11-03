import type { Metadata } from "next";
import { CheckCircle2, Wallet, Users, Video, FileCheck2 } from "lucide-react";
import { SectionTitle } from "@/components/ui/primitives";
import { ContactForm } from "@/components/forms/contact-form";

export const metadata: Metadata = {
  title: "Devenir formateur",
  description:
    "Rejoignez la marketplace DIGINIGER, publiez vos formations après validation et percevez vos revenus en FCFA.",
};

const STEPS = [
  { icon: FileCheck2, title: "Déposer votre candidature", text: "Présentez votre expertise et l'idée de parcours que vous souhaitez publier." },
  { icon: CheckCircle2, title: "Validation pédagogique", text: "Notre comité vérifie votre expérience et la qualité du programme proposé." },
  { icon: Video, title: "Production accompagnée", text: "Notre studio vous aide à structurer, scénariser et enregistrer vos modules." },
  { icon: Wallet, title: "Publication et revenus", text: "Votre formation est publiée et vous percevez 70 % des revenus nets, en FCFA." },
];

export default function InstructorsPage() {
  return (
    <div>
      <section className="border-b border-night-100 bg-mist/60">
        <div className="container-page py-16">
          <SectionTitle
            eyebrow="Devenir formateur"
            title="Partagez votre expertise, touchez des milliers d'apprenants."
            description="DIGINIGER est une marketplace : vous créez le contenu, nous apportons la plateforme, l'accompagnement pédagogique et l'audience. Chaque formation est validée avant publication."
          />
        </div>
      </section>

      <div className="container-page py-14">
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-2xl border border-night-100 bg-white p-5">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-electric-50 text-electric-600">
                  <step.icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="font-display text-2xl font-bold text-night-100">{index + 1}</span>
              </div>
              <h2 className="mt-4 text-sm font-semibold">{step.title}</h2>
              <p className="mt-1 text-sm text-night-400">{step.text}</p>
            </li>
          ))}
        </ol>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-night-100 bg-white p-6">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-electric-600" aria-hidden />
                <h2 className="text-base font-semibold">Ce que nous recherchons</h2>
              </div>
              <ul className="mt-4 space-y-2.5 text-sm text-night-500">
                {[
                  "Au moins 3 ans d'expérience pratique dans votre domaine",
                  "Capacité à enseigner en français clair (l'anglais est un plus)",
                  "Engagement sur la qualité et la réactivité auprès des apprenants",
                  "Un projet pédagogique utile aux réalités économiques de la région",
                  "Une démarche de mise à jour continue des contenus",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-3xl border border-gold-100 bg-gold-50/60 p-6">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-gold-600" aria-hidden />
                <h2 className="text-base font-semibold">Modèle de revenus</h2>
              </div>
              <p className="mt-2 text-sm text-night-600">
                Le formateur perçoit <strong>70 %</strong> du revenu net de chaque vente. Les
                versements sont mensuels, par Mobile Money ou virement bancaire.
              </p>
              <dl className="mt-4 space-y-2 text-sm">
                {[
                  ["Prix de la formation", "25 000 FCFA"],
                  ["Revenu net par apprenant", "17 500 FCFA"],
                  ["100 apprenants", "1 750 000 FCFA"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between border-b border-gold-100 pb-2">
                    <dt className="text-night-500">{label}</dt>
                    <dd className="font-semibold text-night-800">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-night-400">
                Exemple illustratif : les montants réels dépendent du prix, des promotions et du
                volume de ventes.
              </p>
            </section>
          </div>

          <section id="candidature" className="rounded-3xl border border-night-100 bg-white p-6 shadow-soft sm:p-8">
            <h2 className="text-lg font-semibold">Proposer ma formation</h2>
            <p className="mt-1 text-sm text-night-400">
              Décrivez votre projet : notre équipe pédagogique vous répond sous 48 heures ouvrées.
            </p>
            <div className="mt-6">
              <ContactForm
                kind="instructor"
                submitLabel="Envoyer ma candidature"
                showOrganisation={false}
                showSubject={false}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
