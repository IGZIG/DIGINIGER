import type { Metadata } from "next";
import { CheckCircle2, HelpCircle } from "lucide-react";
import { SectionTitle } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { listPlans } from "@/lib/queries";
import { formatXof } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Tarifs et abonnements",
  description: "Offres DIGINIGER en FCFA : gratuit, standard, premium et solutions entreprises.",
};

const FAQ = [
  {
    q: "Puis-je changer d'offre à tout moment ?",
    a: "Oui. Le changement prend effet immédiatement : la différence est calculée au prorata et le nouvel accès est ouvert dès la confirmation du paiement.",
  },
  {
    q: "Quels moyens de paiement acceptez-vous ?",
    a: "Le paiement par Mobile Money (Airtel Money, Orange Money, Moov) est privilégié, avec carte bancaire pour les paiements internationaux. Chaque transaction est vérifiée côté serveur avant ouverture de l'accès.",
  },
  {
    q: "Les formations restent-elles accessibles si j'arrête mon abonnement ?",
    a: "Les formations achetées séparément restent accessibles à vie. Les formations débloquées via un abonnement restent accessibles jusqu'à la fin de la période payée.",
  },
  {
    q: "Existe-t-il des réductions ?",
    a: "Des codes promotionnels sont proposés lors des campagnes de rentrée. Les organisations bénéficient d'un devis dégressif selon le nombre de collaborateurs.",
  },
];

export default async function PricingPage() {
  const plans = await listPlans();
  const individual = plans.filter((plan) => plan.audience === "individual");
  const business = plans.find((plan) => plan.audience === "business");

  return (
    <div>
      <div className="border-b border-night-100 bg-mist/60">
        <div className="container-page py-14 text-center">
          <SectionTitle
            align="center"
            eyebrow="Tarifs"
            title="Des tarifs clairs, en FCFA."
            description="Commencez gratuitement, puis choisissez la formule adaptée à votre rythme. Sans engagement, résiliable à tout moment."
          />
        </div>
      </div>

      <div className="container-page py-12">
        <div className="grid gap-6 lg:grid-cols-3">
          {individual.map((plan) => (
            <article
              key={plan.id}
              className={
                plan.is_featured
                  ? "relative flex flex-col rounded-3xl border-2 border-electric-500 bg-white p-7 shadow-lift"
                  : "flex flex-col rounded-3xl border border-night-100 bg-white p-7 shadow-soft"
              }
            >
              {plan.is_featured && (
                <Badge tone="electric" className="absolute -top-3 left-7 bg-electric-500 text-white">
                  Le plus choisi
                </Badge>
              )}
              <h2 className="font-display text-xl font-semibold">{plan.name_fr}</h2>
              <p className="mt-1.5 min-h-[40px] text-sm text-night-400">{plan.description_fr}</p>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="font-display text-3xl font-bold">
                  {plan.price_xof === 0 ? "Gratuit" : formatXof(plan.price_xof)}
                </span>
                {plan.price_xof > 0 && <span className="text-sm text-night-400">/ mois</span>}
              </p>
              <p className="mt-1 text-xs text-night-300">
                Tuteur IA : {plan.ai_messages_per_day >= 1000 ? "illimité" : `${plan.ai_messages_per_day} messages / jour`}
              </p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {plan.features_fr.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-night-500">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
              <ButtonLink
                href={plan.price_xof === 0 ? "/inscription" : `/paiement?plan=${plan.id}`}
                variant={plan.is_featured ? "primary" : "outline"}
                className="mt-7 w-full"
              >
                {plan.price_xof === 0 ? "Commencer gratuitement" : "Choisir cette offre"}
              </ButtonLink>
            </article>
          ))}
        </div>

        {business && (
          <section className="mt-8 overflow-hidden rounded-3xl bg-night-800 p-8 lg:p-10">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
              <div>
                <Badge className="border-white/20 bg-white/10 text-white">Organisations</Badge>
                <h2 className="mt-4 font-display text-2xl font-semibold text-white">
                  {business.name_fr} — sur devis
                </h2>
                <p className="mt-2 max-w-xl text-sm text-white/60">{business.description_fr}</p>
                <ul className="mt-4 grid gap-2 text-sm text-white/70 sm:grid-cols-2">
                  {business.features_fr.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-gold-400" aria-hidden />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <BookingButtons />
            </div>
          </section>
        )}

        <section className="mt-16">
          <h2 className="text-xl font-semibold">Questions sur les tarifs</h2>
          <div className="mt-5 space-y-3">
            {FAQ.map((item) => (
              <details key={item.q} className="group rounded-2xl border border-night-100 bg-white p-5">
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold text-night-800">
                  <span className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-electric-500" aria-hidden />
                    {item.q}
                  </span>
                  <span className="text-night-300 transition-transform group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-night-400">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function BookingButtons() {
  return (
    <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
      <ButtonLink href="/contact" variant="gold">Demander un devis</ButtonLink>
      <ButtonLink href="/entreprises" variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10">
        Voir les solutions
      </ButtonLink>
    </div>
  );
}
