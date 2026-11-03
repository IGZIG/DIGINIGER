import type { Metadata } from "next";
import { Sparkles, BrainCircuit, FileSearch, Target, ShieldCheck, MessagesSquare } from "lucide-react";
import { SectionTitle } from "@/components/ui/primitives";
import { AiTutorPanel } from "@/components/marketing/ai-tutor-panel";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Tuteur IA",
  description:
    "DIGINIGER AI Tutor : un assistant pédagogique qui s'appuie sur les contenus validés de vos formations.",
};

const CAPABILITIES = [
  { icon: BrainCircuit, title: "Expliquer autrement", text: "Une notion complexe reformulée avec des exemples adaptés à votre niveau et à votre contexte." },
  { icon: FileSearch, title: "Répondre sur vos cours", text: "Les réponses s'appuient sur les documents pédagogiques validés par le formateur (RAG)." },
  { icon: Target, title: "Générer des exercices", text: "Des questions ciblées sur vos points faibles, avec correction détaillée." },
  { icon: MessagesSquare, title: "Suivre vos progrès", text: "Le tuteur connaît vos scores récents et adapte ses recommandations." },
  { icon: ShieldCheck, title: "Cadré et traçable", text: "Chaque échange est journalisé, limité par quota et rattaché à un cours." },
];

export default function TutorPage() {
  return (
    <div>
      <section className="border-b border-night-100 bg-mist/60">
        <div className="container-page grid items-center gap-10 py-16 lg:grid-cols-2">
          <div>
            <SectionTitle
              eyebrow="DIGINIGER AI Tutor"
              title="Un tuteur qui ne remplace pas le formateur : il le prolonge."
              description="Disponible 24 h/24, le tuteur IA répond à vos questions en s'appuyant uniquement sur les contenus validés de votre formation, et vous signale quand demander l'avis d'un formateur."
            />
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/inscription" size="lg">Essayer gratuitement</ButtonLink>
              <ButtonLink href="/formations" variant="outline" size="lg">Voir les formations</ButtonLink>
            </div>
          </div>
          <AiTutorPanel />
        </div>
      </section>

      <div className="container-page py-14">
        <h2 className="text-xl font-semibold">Ce que le tuteur sait faire</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((capability) => (
            <div key={capability.title} className="rounded-2xl border border-night-100 bg-white p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-electric-50 text-electric-600">
                <capability.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-3.5 text-sm font-semibold">{capability.title}</h3>
              <p className="mt-1 text-sm text-night-400">{capability.text}</p>
            </div>
          ))}
        </div>

        <section className="mt-12 rounded-3xl border border-night-100 bg-white p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gold-500" aria-hidden />
            <h2 className="text-base font-semibold">Comment fonctionne le tuteur</h2>
          </div>
          <ol className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              { step: "1", title: "Vous posez une question", text: "Dans le contexte d'une formation à laquelle vous êtes inscrit." },
              { step: "2", title: "Recherche documentaire", text: "La plateforme retrouve les passages pertinents dans les documents validés." },
              { step: "3", title: "Réponse sourcée", text: "Le modèle répond en citant les extraits utilisés, dans la limite de votre quota." },
            ].map((item) => (
              <li key={item.step} className="rounded-2xl bg-mist p-4">
                <span className="font-display text-sm font-bold text-electric-600">Étape {item.step}</span>
                <p className="mt-1.5 text-sm font-semibold text-night-800">{item.title}</p>
                <p className="mt-1 text-sm text-night-400">{item.text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-5 rounded-xl bg-gold-50 px-4 py-3 text-xs leading-relaxed text-gold-800">
            Transparence : le tuteur IA est un outil d&apos;aide à la révision. Il peut se tromper et
            ne remplace ni l&apos;évaluation humaine ni le jugement du formateur.
          </p>
        </section>
      </div>
    </div>
  );
}
