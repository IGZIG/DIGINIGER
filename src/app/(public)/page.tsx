import Link from "next/link";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  Briefcase,
  Calculator,
  CheckCircle2,
  Cpu,
  GraduationCap,
  Megaphone,
  Rocket,
  ShieldCheck,
  Sprout,
  Star,
  Users,
  Wrench,
  Sparkles,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionTitle } from "@/components/ui/primitives";
import { CourseCard } from "@/components/marketing/course-card";
import { AiTutorPanel } from "@/components/marketing/ai-tutor-panel";
import { HeroIllustration } from "@/components/marketing/hero-illustration";
import { listPlans, listPublicCourses, listSchools } from "@/lib/queries";
import { formatXof, formatNumber } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export const revalidate = 300; // Catalogue rafraîchi toutes les 5 minutes

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  cpu: Cpu,
  briefcase: Briefcase,
  sprout: Sprout,
  calculator: Calculator,
  megaphone: Megaphone,
  wrench: Wrench,
};

const HOW_IT_WORKS = [
  { title: "Créer un compte", text: "Inscription en deux minutes, par email. Aucune carte bancaire." },
  { title: "Choisir une formation", text: "Parcours filtrables par école, niveau, durée et budget." },
  { title: "Apprendre avec des experts et l'IA", text: "Leçons vidéo, fiches, exercices et tuteur disponible 24/7." },
  { title: "Évaluer ses compétences", text: "Quiz corrigés, projets notés et examens de fin de parcours." },
  { title: "Obtenir un certificat", text: "Un certificat vérifiable, partageable avec un QR code." },
];

const TESTIMONIALS = [
  {
    name: "Aminata B.",
    role: "Assistante comptable, Niamey",
    text: "J'ai suivi la formation SYSCOHADA en travaillant. Les exercices corrigés et le tuteur IA m'ont permis de comprendre mes erreurs au lieu de les répéter.",
  },
  {
    name: "Yacouba M.",
    role: "Technicien solaire, Maradi",
    text: "Le parcours pompage solaire est très concret. J'ai appliqué les calculs de dimensionnement sur mon premier chantier deux semaines après.",
  },
  {
    name: "Rahila S.",
    role: "Fondatrice d'une coopérative, Dosso",
    text: "Le module agro-business m'a aidée à structurer toute ma chaîne de valeur, de la production à la vente.",
  },
];

export default async function HomePage() {
  const [{ locale, t }, schools, courses, plans] = await Promise.all([
    getT(),
    listSchools(),
    listPublicCourses({ limit: 6, sort: "popular" }),
    listPlans(),
  ]);
  const en = locale === "en";

  const individualPlans = plans.filter((plan) => plan.audience === "individual");
  const totalStudents = courses.reduce((sum, course) => sum + course.enrollment_count, 0);

  return (
    <>
      {/* ---------------------------------------------------------------- HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-mist to-white pb-16 pt-12 lg:pb-24 lg:pt-16">
        <div
          className="pointer-events-none absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-electric-500/10 blur-3xl"
          aria-hidden
        />
        <div className="container-page grid items-center gap-12 lg:grid-cols-2">
          <div className="animate-fade-up">
            <p className="eyebrow mb-5">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {t.home.eyebrow}
            </p>
            <h1 className="text-4xl font-semibold leading-[1.1] sm:text-5xl lg:text-[3.4rem]">
              {en ? "Build the skills that will shape" : "Développez les compétences qui"}{" "}
              <span className="relative whitespace-nowrap text-electric-600">
                {en ? "shape" : "construiront"}
                <svg
                  className="absolute -bottom-1 left-0 w-full"
                  height="8"
                  viewBox="0 0 200 8"
                  fill="none"
                  aria-hidden
                >
                  <path d="M2 6C50 2 150 2 198 5" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </span>{" "}
              {en ? "your future." : "votre avenir."}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-night-400">
              {t.home.subtitle}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/formations" size="lg">
                {t.home.ctaPrimary}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </ButtonLink>
              <ButtonLink href="/inscription" variant="outline" size="lg">
                {en ? "Get started free" : "Commencer gratuitement"}
              </ButtonLink>
            </div>

            <dl className="mt-10 grid max-w-lg grid-cols-2 gap-x-6 gap-y-5 border-t border-night-100 pt-6 sm:grid-cols-4">
              {[
                { value: "6", label: "écoles" },
                { value: `${formatNumber(totalStudents)}+`, label: "apprenants" },
                { value: "94 %", label: "satisfaction" },
                { value: "24/7", label: "tuteur IA" },
              ].map((stat) => (
                <div key={stat.label}>
                  <dt className="text-xs uppercase tracking-wider text-night-300">{stat.label}</dt>
                  <dd className="mt-1 font-display text-2xl font-bold text-night-800">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="animate-fade-up lg:justify-self-end">
            <HeroIllustration />
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- ÉCOLES */}
      <section className="container-page py-16 lg:py-24" aria-labelledby="ecoles-title">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionTitle
            eyebrow={en ? "Our schools" : "Nos écoles"}
            title={t.home.schoolsTitle}
            description={t.home.schoolsSubtitle}
          />
          <ButtonLink href="/ecoles" variant="outline" size="sm" className="shrink-0">
            {en ? "All schools" : "Toutes les écoles"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </ButtonLink>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {schools.map((school) => {
            const Icon = ICONS[school.icon] ?? GraduationCap;
            return (
              <article
                key={school.id}
                className="group relative flex flex-col overflow-hidden rounded-3xl border border-night-100 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-lift"
              >
                <span
                  className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
                  style={{ backgroundColor: school.accent }}
                  aria-hidden
                />
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: `${school.accent}14`, color: school.accent }}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{en ? school.name_en : school.name_fr}</h3>
                <p className="mt-1 text-sm font-medium text-night-400">
                  {en ? school.tagline_en : school.tagline_fr}
                </p>
                <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-night-400">
                  {en ? school.description_en : school.description_fr}
                </p>
                <Link
                  href={`/ecoles/${school.slug}`}
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-electric-600 hover:text-electric-700"
                >
                  {en ? "Explore the school" : "Explorer l'école"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      {/* ---------------------------------------------------------- FORMATIONS */}
      <section className="bg-mist py-16 lg:py-24" aria-labelledby="formations-title">
        <div className="container-page">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <SectionTitle
              eyebrow={en ? "Popular courses" : "Formations populaires"}
              title={t.home.popularTitle}
              description={t.home.popularSubtitle}
            />
            <ButtonLink href="/formations" variant="outline" size="sm" className="shrink-0">
              {en ? "Browse the full catalogue" : "Voir tout le catalogue"}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </ButtonLink>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- TUTEUR IA */}
      <section className="container-page py-16 lg:py-24" aria-labelledby="tuteur-title">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionTitle
              eyebrow="DIGINIGER AI Tutor"
              title={en
                ? "A personal tutor, available around the clock."
                : "Un assistant pédagogique personnel, disponible à toute heure."}
              description={t.tutor.subtitle}
            />
            <ul className="mt-8 space-y-4">
              {[
                ...(en
                  ? [
                      { icon: BrainCircuit, title: "Tailored explanations", text: "A complex idea restated simply, with local examples." },
                      { icon: CheckCircle2, title: "Adaptive exercises", text: "The tutor spots weak points and suggests the right practice." },
                      { icon: ShieldCheck, title: "Verified content", text: "Answers grounded in documents validated by instructors." },
                      { icon: Rocket, title: "Personalised path", text: "Course recommendations aligned with your goals." },
                    ]
                  : [
                      { icon: BrainCircuit, title: "Explications personnalisées", text: "Une notion complexe reformulée simplement, avec des exemples locaux." },
                      { icon: CheckCircle2, title: "Exercices adaptatifs", text: "Le tuteur identifie les points faibles et propose les exercices utiles." },
                      { icon: ShieldCheck, title: "Contenus vérifiés", text: "Réponses fondées sur les documents validés par les formateurs." },
                      { icon: Rocket, title: "Parcours personnalisé", text: "Des recommandations de cours alignées sur vos objectifs." },
                    ]),
              ].map((feature) => (
                <li key={feature.title} className="flex gap-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-electric-50 text-electric-600">
                    <feature.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-semibold text-night-800">{feature.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-night-400">{feature.text}</p>
                  </div>
                </li>
              ))}
            </ul>
            <ButtonLink href="/tuteur-ia" variant="secondary" className="mt-8">
              Découvrir le tuteur IA
              <ArrowRight className="h-4 w-4" aria-hidden />
            </ButtonLink>
          </div>

          <AiTutorPanel />
        </div>
      </section>

      {/* ------------------------------------------------------- COMMENT ÇA MARCHE */}
      <section className="bg-night-900 py-16 text-white lg:py-24" aria-labelledby="etapes-title">
        <div className="container-page">
          <div className="max-w-2xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-gold-400">
              Comment ça marche
            </p>
            <h2 id="etapes-title" className="text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Cinq étapes, de l&apos;inscription au certificat.
            </h2>
          </div>

          <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            {HOW_IT_WORKS.map((step, index) => (
              <li key={step.title} className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-electric-500 font-display text-sm font-bold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-base font-semibold text-white">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/50">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------ FORMATEURS */}
      <section className="container-page py-16 lg:py-24" aria-labelledby="formateurs-title">
        <div className="overflow-hidden rounded-4xl border border-night-100 bg-gradient-to-br from-white to-mist p-8 lg:p-14">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <SectionTitle
                eyebrow="Devenir formateur"
                title="Votre expertise mérite un public régional."
                description="Publiez votre formation sur DIGINIGER, après validation par notre comité pédagogique, et percevez vos revenus en FCFA. Nous vous accompagnons de la scénarisation au tournage."
              />
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  "Accompagnement pédagogique",
                  "Revenus transparents en FCFA",
                  "Outils de création de cours",
                  "Visibilité entreprises",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-night-500">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/formateurs">Proposer ma formation</ButtonLink>
                <ButtonLink href="/formateurs#candidature" variant="outline">
                  Voir le programme
                </ButtonLink>
              </div>
            </div>

            <div className="rounded-3xl border border-night-100 bg-white p-6 shadow-card">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-50 text-gold-600">
                  <GraduationCap className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold">Exemple de revenus formateur</p>
                  <p className="text-xs text-night-400">Simulation — 70 % des revenus nets</p>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                {[
                  { label: "120 apprenants × 25 000 FCFA", value: "3 000 000" },
                  { label: "Part formateur (70 %)", value: "2 100 000" },
                  { label: "Versement mensuel estimé", value: "700 000" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between border-b border-night-100 pb-3 text-sm">
                    <span className="text-night-500">{row.label}</span>
                    <span className="font-semibold text-night-800">{row.value} FCFA</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-night-300">
                Exemple illustratif de démonstration : vos revenus dépendent du prix, du volume et
                des remises appliquées.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- ENTREPRISES */}
      <section className="bg-mist py-16 lg:py-24" aria-labelledby="entreprises-title">
        <div className="container-page grid items-center gap-12 lg:grid-cols-2">
          <div className="order-2 grid gap-4 sm:grid-cols-2 lg:order-1">
            {[
              { icon: Users, title: "Diagnostic des compétences", text: "Un audit rapide pour cibler les écarts réels." },
              { icon: Briefcase, title: "Parcours sur mesure", text: "Des modules construits avec vos référents métier." },
              { icon: Star, title: "Suivi et reporting", text: "Assiduité, scores et certifications dans un tableau de bord." },
              { icon: ShieldCheck, title: "Facturation locale", text: "Devis en FCFA, conventions et sessions sur site." },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-night-100 bg-white p-5">
                <item.icon className="h-5 w-5 text-electric-600" aria-hidden />
                <p className="mt-3 font-semibold">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-night-400">{item.text}</p>
              </div>
            ))}
          </div>

          <div className="order-1 lg:order-2">
            <SectionTitle
              eyebrow="Entreprises & organisations"
              title="Formez vos équipes avec un plan de compétences sur mesure."
              description="Banques, opérateurs télécoms, coopératives agricoles, institutions publiques : nous concevons des parcours adaptés à vos métiers, avec suivi de progression et attestations."
            />
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/entreprises">Demander une présentation</ButtonLink>
              <ButtonLink href="/contact" variant="outline">
                Parler à un conseiller
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------- TARIFS */}
      <section className="container-page py-16 lg:py-24" aria-labelledby="tarifs-title">
        <SectionTitle
          align="center"
          eyebrow="Tarifs"
          title="Une formule pour chaque ambition."
          description="Commencez gratuitement, puis choisissez la formule adaptée à votre rythme. Prix en FCFA, sans engagement."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {individualPlans.map((plan) => (
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
              <h3 className="font-display text-xl font-semibold">{plan.name_fr}</h3>
              <p className="mt-1.5 min-h-[40px] text-sm text-night-400">{plan.description_fr}</p>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="font-display text-3xl font-bold">
                  {plan.price_xof === 0 ? "Gratuit" : formatXof(plan.price_xof)}
                </span>
                {plan.price_xof > 0 && <span className="text-sm text-night-400">/ mois</span>}
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
                href={`/inscription?plan=${plan.code}`}
                variant={plan.is_featured ? "primary" : "outline"}
                className="mt-7 w-full"
              >
                {plan.price_xof === 0 ? "Commencer gratuitement" : "Choisir cette offre"}
              </ButtonLink>
            </article>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-night-300">
          Prix affichés en FCFA · Paiement Mobile Money · Facturation entreprise sur devis
        </p>
      </section>

      {/* ---------------------------------------------------------- TÉMOIGNAGES */}
      <section className="bg-mist py-16 lg:py-24" aria-labelledby="temoignages-title">
        <div className="container-page">
          <SectionTitle
            align="center"
            eyebrow="Témoignages"
            title="Ils apprennent et entreprennent avec DIGINIGER."
            description="Retours d'expérience d'apprenants de la première cohorte (profils de démonstration)."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((item) => (
              <figure key={item.name} className="flex flex-col rounded-3xl border border-night-100 bg-white p-6 shadow-soft">
                <div className="flex gap-0.5" aria-label="Note : 5 sur 5">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} className="h-4 w-4 fill-gold-500 text-gold-500" aria-hidden />
                  ))}
                </div>
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-night-500">
                  « {item.text} »
                </blockquote>
                <figcaption className="mt-5 border-t border-night-100 pt-4">
                  <p className="text-sm font-semibold">{item.name}</p>
                  <p className="text-xs text-night-400">{item.role}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- CTA FINAL */}
      <section className="container-page py-16 lg:py-24">
        <div className="relative overflow-hidden rounded-4xl bg-night-800 px-8 py-14 text-center lg:px-16">
          <div className="pointer-events-none absolute inset-0 grid-lines opacity-40" aria-hidden />
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-electric-500/25 blur-3xl" aria-hidden />
          <div className="relative mx-auto max-w-2xl">
            <Bot className="mx-auto h-10 w-10 text-gold-400" aria-hidden />
            <h2 className="mt-5 text-3xl font-semibold text-white sm:text-4xl">
              Prêt à construire votre avenir, une compétence à la fois ?
            </h2>
            <p className="mt-4 text-white/60">
              Créez votre compte gratuitement et accédez à vos premières leçons dès aujourd&apos;hui.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href="/inscription" size="lg" variant="gold">
                Créer mon compte
              </ButtonLink>
              <ButtonLink
                href="/contact"
                size="lg"
                variant="outline"
                className="border-white/20 bg-transparent text-white hover:bg-white/10"
              >
                Parler à un conseiller
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
