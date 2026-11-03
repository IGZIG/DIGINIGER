"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PenSquare, Sparkles, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/fields";
import { Alert } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { createCourseAction, generateCourseDraftAction, materializeDraftAction } from "@/lib/actions/instructor";
import { cn } from "@/lib/utils";
import type { GeneratedCourseDraft } from "@/types/database";

/**
 * Constructeur de formation : mode manuel ou assistant IA.
 * Le brouillon IA n'est JAMAIS publié automatiquement : il est relu, puis
 * matérialisé en formation au statut « brouillon », soumise à validation.
 */
export function CourseBuilder({
  schools,
  aiConfigured,
}: {
  schools: { id: string; name: string }[];
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"manual" | "ai">("manual");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ id: string; data: GeneratedCourseDraft } | null>(null);

  // --- Création manuelle ---------------------------------------------------
  function submitManual(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createCourseAction(formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/formateur/formations/${result.data.id}`);
    });
  }

  // --- Génération IA -------------------------------------------------------
  function submitAi(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await generateCourseDraftAction(formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setDraft({ id: result.data.generationId, data: result.data.draft });
    });
  }

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-full border border-night-200 bg-white p-1">
        {[
          { id: "manual" as const, label: "Création manuelle", icon: PenSquare },
          { id: "ai" as const, label: "Assistant IA", icon: Sparkles },
        ].map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              setTab(option.id);
              setError(null);
            }}
            aria-pressed={tab === option.id}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              tab === option.id ? "bg-night-800 text-white" : "text-night-500 hover:text-night-800",
            )}
          >
            <option.icon className="h-4 w-4" aria-hidden />
            {option.label}
          </button>
        ))}
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {tab === "manual" && (
        <form action={submitManual} className="rounded-2xl border border-night-100 bg-white p-6">
          <h3 className="text-base font-semibold">Informations générales</h3>
          <p className="mt-1 text-sm text-night-400">
            La formation est créée au statut brouillon. Vous ajouterez ensuite les modules, leçons
            et exercices.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="title" required>Titre de la formation</Label>
              <Input id="title" name="title" required minLength={6} maxLength={140} placeholder="Ex. Gestion de trésorerie pour PME" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="subtitle">Sous-titre</Label>
              <Input id="subtitle" name="subtitle" maxLength={220} placeholder="Une phrase qui résume la promesse du parcours" />
            </div>
            <div>
              <Label htmlFor="schoolId" required>École</Label>
              <Select id="schoolId" name="schoolId" required defaultValue="">
                <option value="" disabled>Sélectionner…</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>{school.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="level" required>Niveau</Label>
              <Select id="level" name="level" defaultValue="debutant">
                <option value="debutant">Débutant</option>
                <option value="intermediaire">Intermédiaire</option>
                <option value="avance">Avancé</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="priceXof" required>Prix (FCFA) — 0 = gratuit</Label>
              <Input id="priceXof" name="priceXof" type="number" min={0} max={1000000} step={500} defaultValue={0} required />
            </div>
            <div>
              <Label htmlFor="durationHours" required>Durée (heures)</Label>
              <Input id="durationHours" name="durationHours" type="number" min={0.5} max={300} step={0.5} defaultValue={10} required />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" maxLength={4000} placeholder="Contenu, méthode, projet final…" />
            </div>
            <div>
              <Label htmlFor="outcomes">Objectifs (une ligne par élément)</Label>
              <Textarea id="outcomes" name="outcomes" className="min-h-[90px]" placeholder={"Maîtriser X\nSavoir appliquer Y"} />
            </div>
            <div>
              <Label htmlFor="prerequisites">Prérequis (une ligne par élément)</Label>
              <Textarea id="prerequisites" name="prerequisites" className="min-h-[90px]" placeholder={"Aucun prérequis\nBases de calcul"} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="audience">Public visé (une ligne par élément)</Label>
              <Textarea id="audience" name="audience" className="min-h-[70px]" placeholder={"Étudiants\nProfessionnels en reconversion"} />
            </div>
          </div>

          <Button type="submit" className="mt-6" loading={pending}>
            Créer le brouillon
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </form>
      )}

      {tab === "ai" && (
        <div className="space-y-5">
          {!aiConfigured ? (
            <Alert tone="warning" title="Assistant IA non configuré">
              La clé du fournisseur de modèles est absente sur ce serveur. La génération est donc
              désactivée : aucune trame n&apos;est inventée à votre place. Ajoutez{" "}
              <code className="rounded bg-white px-1">OPENAI_API_KEY</code> pour l&apos;activer, ou
              utilisez la création manuelle.
            </Alert>
          ) : (
            <Alert tone="info" title="Ce que fait l'assistant">
              Il produit une trame complète (programme, modules, leçons, exercices) à partir de
              votre sujet. Le résultat est un <strong>brouillon modifiable</strong> : rien n&apos;est
              publié sans votre validation et celle de l&apos;administration.
            </Alert>
          )}

          <form action={submitAi} className="rounded-2xl border border-night-100 bg-white p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="ai-topic" required>Sujet de la formation</Label>
                <Input id="ai-topic" name="topic" required minLength={5} maxLength={160} placeholder="Ex. Initiation à la comptabilité analytique" disabled={!aiConfigured} />
              </div>
              <div>
                <Label htmlFor="ai-school" required>École</Label>
                <Select id="ai-school" name="schoolId" required defaultValue="" disabled={!aiConfigured}>
                  <option value="" disabled>Sélectionner…</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>{school.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="ai-level" required>Niveau</Label>
                <Select id="ai-level" name="level" defaultValue="debutant" disabled={!aiConfigured}>
                  <option value="debutant">Débutant</option>
                  <option value="intermediaire">Intermédiaire</option>
                  <option value="avance">Avancé</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="ai-duration" required>Durée visée (heures)</Label>
                <Input id="ai-duration" name="durationHours" type="number" min={2} max={120} defaultValue={15} required disabled={!aiConfigured} />
              </div>
              <div>
                <Label htmlFor="ai-audience">Public visé</Label>
                <Input id="ai-audience" name="audience" maxLength={200} placeholder="Ex. assistants comptables" disabled={!aiConfigured} />
              </div>
              <div>
                <Label htmlFor="ai-objectives">Objectifs pédagogiques</Label>
                <Input id="ai-objectives" name="objectives" maxLength={600} placeholder="Ex. produire un bilan simplifié" disabled={!aiConfigured} />
              </div>
            </div>

            <Button type="submit" className="mt-6" loading={pending} disabled={!aiConfigured}>
              <Sparkles className="h-4 w-4" aria-hidden />
              Générer un brouillon
            </Button>
          </form>

          {draft && (
            <section className="rounded-2xl border border-electric-100 bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Badge tone="electric">Brouillon généré</Badge>
                  <h3 className="mt-2 font-display text-xl font-semibold">{draft.data.title}</h3>
                  <p className="mt-1 text-sm text-night-400">{draft.data.subtitle}</p>
                </div>
                <span className="text-xs text-night-400">
                  {draft.data.modules?.length ?? 0} modules · {draft.data.exercises?.length ?? 0} évaluations
                </span>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-night-500">{draft.data.description}</p>

              <div className="mt-5 space-y-2">
                {(draft.data.modules ?? []).map((module, index) => (
                  <details key={index} className="group rounded-xl border border-night-100">
                    <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium">
                      <span>
                        Module {index + 1} — {module.title}
                      </span>
                      <span className="text-xs text-night-400">
                        {module.lessons?.length ?? 0} leçons
                      </span>
                    </summary>
                    <ul className="border-t border-night-100 px-4 py-2 text-sm text-night-500">
                      {(module.lessons ?? []).map((lesson, lessonIndex) => (
                        <li key={lessonIndex} className="flex items-center justify-between py-1.5">
                          <span className="truncate">{lesson.title}</span>
                          <span className="ml-3 shrink-0 text-xs text-night-300">
                            {lesson.kind} · {lesson.duration_min} min
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>

              <div className="mt-5 rounded-xl bg-gold-50 px-4 py-3 text-xs leading-relaxed text-gold-800">
                <span className="flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  Contenu généré par IA : relisez et corrigez chaque leçon avant publication. Les
                  formations issues de l&apos;IA restent marquées comme telles en base.
                </span>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  loading={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await materializeDraftAction(draft.id);
                      if (!result.ok) {
                        setError(result.message);
                        return;
                      }
                      router.push(`/formateur/formations/${result.data.courseId}`);
                    })
                  }
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  Créer la formation à partir de ce brouillon
                </Button>
                <Button variant="outline" onClick={() => setDraft(null)}>
                  Rejeter et recommencer
                </Button>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
