"use client";

import { useState } from "react";
import { Sparkles, Send, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Aperçu du tuteur IA sur la page d'accueil.
 * Ce composant ne prétend PAS être l'IA réelle : il illustre l'interface
 * et renvoie l'utilisateur vers l'espace connecté pour poser une vraie question.
 */
const DEMO = [
  {
    q: "Explique-moi la TVA simplement.",
    a: "La TVA est un impôt sur la consommation : quand vous vendez un produit, vous collectez la TVA pour l'État et vous la reversez. Retenez la mécanique : TVA collectée − TVA déductible = TVA à payer.",
  },
  {
    q: "Crée-moi un quiz de 5 questions.",
    a: "Voici 5 questions sur le module en cours, du plus simple au plus difficile, avec correction détaillée. Le tuteur adapte la difficulté à vos derniers résultats.",
  },
  {
    q: "Résume ce chapitre en 5 points.",
    a: "1. Définition et enjeux · 2. Méthode de calcul · 3. Cas pratiques · 4. Erreurs fréquentes · 5. À retenir pour l'examen.",
  },
];

export function AiTutorPanel() {
  const [active, setActive] = useState(0);
  const [question, setQuestion] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-4xl border border-white/10 bg-night-800 shadow-lift">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold-500/15 text-gold-400">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">DIGINIGER AI Tutor</p>
            <p className="text-[11px] text-white/40">Assistant pédagogique</p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
          En ligne
        </span>
      </div>

      <div className="space-y-3 p-5">
        {DEMO.map((item, index) => (
          <button
            key={item.q}
            type="button"
            onClick={() => setActive(index)}
            className={cn(
              "w-full rounded-2xl border px-4 py-3 text-left text-sm transition-colors",
              active === index
                ? "border-gold-500/40 bg-gold-500/10 text-white"
                : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20",
            )}
            aria-pressed={active === index}
          >
            « {item.q} »
          </button>
        ))}

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm leading-relaxed text-white/75">{DEMO[active].a}</p>
        </div>
      </div>

      <form
        className="border-t border-white/10 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          setNotice(
            "Aperçu uniquement : connectez-vous pour utiliser le tuteur IA sur vos propres formations.",
          );
        }}
      >
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Posez votre question…"
            aria-label="Poser une question au tuteur IA"
            className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
          />
          <button
            type="submit"
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-electric-500 text-white transition-colors hover:bg-electric-400"
            aria-label="Envoyer"
          >
            <Send className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {notice && (
          <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-snug text-gold-300" role="status">
            <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            {notice}
          </p>
        )}
      </form>
    </div>
  );
}
