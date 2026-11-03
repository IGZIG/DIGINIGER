"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, Send, Save, ChevronDown, ClipboardList, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/fields";
import { Alert } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import {
  addLessonAction,
  addModuleAction,
  createExerciseAction,
  submitCourseForReview,
  updateCourseAction,
} from "@/lib/actions/instructor";
import { STATUS_LABELS } from "@/lib/utils";
import type { Course, Exercise, Lesson, Module } from "@/types/database";

/**
 * Éditeur de formation : informations générales, programme, évaluations.
 * Le formateur ne peut pas publier lui-même : il soumet à validation
 * (statut in_review), l'administration publie.
 */
export function CourseEditor({
  course,
  modules,
  lessons,
  exercises,
  schools,
}: {
  course: Course;
  modules: Module[];
  lessons: Lesson[];
  exercises: Exercise[];
  schools: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [openModule, setOpenModule] = useState<string | null>(modules[0]?.id ?? null);

  function run(action: () => Promise<{ ok: boolean; message?: string }>, success: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setMessage({ tone: "error", text: result.message ?? "Action impossible." });
        return;
      }
      setMessage({ tone: "success", text: success });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-night-100 bg-white p-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{course.title_fr}</h2>
            <Badge
              tone={
                course.status === "published"
                  ? "green"
                  : course.status === "in_review"
                    ? "gold"
                    : "neutral"
              }
            >
              {STATUS_LABELS[course.status]}
            </Badge>
            {course.source === "ai_generated" && <Badge tone="electric">Généré par IA</Badge>}
          </div>
          <p className="mt-1 text-xs text-night-400">
            {modules.length} modules · {lessons.length} leçons · {exercises.length} évaluations
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {course.status === "published" && (
            <Link
              href={`/formations/${course.slug}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-night-200 px-3.5 py-2 text-xs font-medium text-night-600 hover:bg-night-50"
            >
              <Eye className="h-3.5 w-3.5" aria-hidden />
              Voir la page publique
            </Link>
          )}
          {course.status === "draft" && (
            <Button
              size="sm"
              loading={pending}
              onClick={() =>
                run(
                  () => submitCourseForReview(course.id),
                  "Formation soumise à validation. L'administration la relira avant publication.",
                )
              }
            >
              <Send className="h-4 w-4" aria-hidden />
              Soumettre à validation
            </Button>
          )}
          {course.status === "in_review" && (
            <Badge tone="gold">En attente de validation par l&apos;administration</Badge>
          )}
        </div>
      </div>

      {message && <Alert tone={message.tone === "success" ? "success" : "error"}>{message.text}</Alert>}

      {/* Informations générales */}
      <form
        className="rounded-2xl border border-night-100 bg-white p-6"
        action={(formData) => {
          formData.set("courseId", course.id);
          run(() => updateCourseAction(formData), "Informations enregistrées.");
        }}
      >
        <h3 className="text-base font-semibold">Informations générales</h3>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="title" required>Titre</Label>
            <Input id="title" name="title" defaultValue={course.title_fr} required />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="subtitle">Sous-titre</Label>
            <Input id="subtitle" name="subtitle" defaultValue={course.subtitle_fr} />
          </div>
          <div>
            <Label htmlFor="schoolId" required>École</Label>
            <Select id="schoolId" name="schoolId" defaultValue={course.school_id ?? ""} required>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>{school.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="level" required>Niveau</Label>
            <Select id="level" name="level" defaultValue={course.level}>
              <option value="debutant">Débutant</option>
              <option value="intermediaire">Intermédiaire</option>
              <option value="avance">Avancé</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="priceXof" required>Prix (FCFA)</Label>
            <Input id="priceXof" name="priceXof" type="number" min={0} step={500} defaultValue={course.price_xof} required />
          </div>
          <div>
            <Label htmlFor="durationHours" required>Durée (heures)</Label>
            <Input id="durationHours" name="durationHours" type="number" min={0.5} step={0.5} defaultValue={course.duration_hours} required />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" defaultValue={course.description_fr} />
          </div>
          <div>
            <Label htmlFor="outcomes">Objectifs</Label>
            <Textarea id="outcomes" name="outcomes" defaultValue={course.outcomes.join("\n")} className="min-h-[90px]" />
          </div>
          <div>
            <Label htmlFor="prerequisites">Prérequis</Label>
            <Textarea id="prerequisites" name="prerequisites" defaultValue={course.prerequisites.join("\n")} className="min-h-[90px]" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="audience">Public visé</Label>
            <Textarea id="audience" name="audience" defaultValue={course.audience.join("\n")} className="min-h-[70px]" />
          </div>
        </div>

        <Button type="submit" className="mt-5" loading={pending}>
          <Save className="h-4 w-4" aria-hidden />
          Enregistrer
        </Button>
      </form>

      {/* Programme */}
      <section className="rounded-2xl border border-night-100 bg-white p-6">
        <h3 className="text-base font-semibold">Programme</h3>
        <p className="mt-1 text-sm text-night-400">
          Structurez votre cours en modules, puis ajoutez les leçons. Tant qu&apos;un module n&apos;a
          pas de leçon, la progression ne peut pas être calculée pour les apprenants.
        </p>

        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          action={(formData) => {
            const title = String(formData.get("moduleTitle") ?? "");
            run(() => addModuleAction(course.id, title), "Module ajouté.");
          }}
        >
          <Input name="moduleTitle" placeholder="Titre du nouveau module" required minLength={3} />
          <Button type="submit" variant="outline" loading={pending}>
            <Plus className="h-4 w-4" aria-hidden />
            Ajouter un module
          </Button>
        </form>

        <div className="mt-5 space-y-2">
          {modules.length === 0 && (
            <p className="rounded-xl bg-mist px-4 py-6 text-center text-sm text-night-400">
              Aucun module pour l&apos;instant. Ajoutez-en un pour commencer.
            </p>
          )}

          {modules.map((module, index) => {
            const moduleLessons = lessons.filter((lesson) => lesson.module_id === module.id);
            const open = openModule === module.id;

            return (
              <div key={module.id} className="rounded-xl border border-night-100">
                <button
                  type="button"
                  onClick={() => setOpenModule(open ? null : module.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  aria-expanded={open}
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-electric-50 text-xs font-bold text-electric-700">
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{module.title_fr}</span>
                      <span className="block text-xs text-night-400">{moduleLessons.length} leçon(s)</span>
                    </span>
                  </span>
                  <ChevronDown className={`h-4 w-4 text-night-300 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
                </button>

                {open && (
                  <div className="border-t border-night-100 p-4">
                    {moduleLessons.length > 0 && (
                      <ul className="mb-4 divide-y divide-night-100">
                        {moduleLessons.map((lesson) => (
                          <li key={lesson.id} className="flex items-center justify-between gap-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm text-night-700">{lesson.title_fr}</p>
                              <p className="text-xs text-night-400">
                                {lesson.kind} · {lesson.duration_min} min
                                {lesson.is_preview ? " · aperçu gratuit" : ""}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Supprimer la leçon ${lesson.title_fr}`}
                              onClick={() =>
                                run(
                                  async () => {
                                    const { deleteLessonAction } = await import("@/lib/actions/instructor");
                                    const result = await deleteLessonAction(lesson.id);
                                    return result.ok ? { ok: true } : { ok: false, message: result.message };
                                  },
                                  "Leçon supprimée.",
                                )
                              }
                            >
                              <Trash2 className="h-4 w-4 text-red-500" aria-hidden />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}

                    <form
                      className="grid gap-3 rounded-xl bg-mist/60 p-3 sm:grid-cols-2"
                      action={(formData) => {
                        formData.set("moduleId", module.id);
                        run(() => addLessonAction(formData), "Leçon ajoutée.");
                      }}
                    >
                      <div className="sm:col-span-2">
                        <Label htmlFor={`lesson-title-${module.id}`} required>Titre de la leçon</Label>
                        <Input id={`lesson-title-${module.id}`} name="title" required minLength={3} />
                      </div>
                      <div>
                        <Label htmlFor={`lesson-kind-${module.id}`} required>Type</Label>
                        <Select id={`lesson-kind-${module.id}`} name="kind" defaultValue="reading">
                          <option value="video">Vidéo</option>
                          <option value="reading">Lecture</option>
                          <option value="exercise">Exercice</option>
                          <option value="project">Projet</option>
                          <option value="live">Session live</option>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor={`lesson-duration-${module.id}`} required>Durée (min)</Label>
                        <Input id={`lesson-duration-${module.id}`} name="durationMin" type="number" min={1} defaultValue={15} required />
                      </div>
                      <div className="sm:col-span-2">
                        <Label htmlFor={`lesson-video-${module.id}`}>URL vidéo (optionnel)</Label>
                        <Input id={`lesson-video-${module.id}`} name="videoUrl" type="url" placeholder="https://…" />
                      </div>
                      <div className="sm:col-span-2">
                        <Label htmlFor={`lesson-content-${module.id}`}>Contenu (markdown simple)</Label>
                        <Textarea id={`lesson-content-${module.id}`} name="content" className="min-h-[100px]" placeholder={"## Objectifs\n- Comprendre…\n- Savoir…"} />
                      </div>
                      <div className="sm:col-span-2">
                        <Button type="submit" size="sm" loading={pending}>
                          <Plus className="h-4 w-4" aria-hidden />
                          Ajouter la leçon
                        </Button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Évaluations */}
      <section className="rounded-2xl border border-night-100 bg-white p-6">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-night-400" aria-hidden />
          <h3 className="text-base font-semibold">Exercices et examens</h3>
        </div>

        {exercises.length === 0 ? (
          <p className="mt-3 rounded-xl bg-mist px-4 py-4 text-sm text-night-400">
            Aucune évaluation. Un examen publié est obligatoire pour débloquer le certificat des
            apprenants.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-night-100">
            {exercises.map((exercise) => (
              <li key={exercise.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-medium">{exercise.title_fr}</p>
                  <p className="text-xs text-night-400">
                    {exercise.questions.length} questions · seuil {exercise.pass_score}/100
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {exercise.is_exam && <Badge tone="night">Examen</Badge>}
                  <Badge tone={exercise.is_published ? "green" : "neutral"}>
                    {exercise.is_published ? "Publié" : "Brouillon"}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}

        <details className="mt-4 rounded-xl border border-night-100 p-4">
          <summary className="cursor-pointer text-sm font-medium text-night-700">
            Ajouter une évaluation (format JSON)
          </summary>
          <form
            className="mt-4 grid gap-3 sm:grid-cols-2"
            action={(formData) => {
              formData.set("courseId", course.id);
              run(() => createExerciseAction(formData), "Évaluation créée en brouillon.");
            }}
          >
            <div className="sm:col-span-2">
              <Label htmlFor="ex-title" required>Titre</Label>
              <Input id="ex-title" name="title" required minLength={4} />
            </div>
            <div>
              <Label htmlFor="ex-pass" required>Seuil de réussite (sur 100)</Label>
              <Input id="ex-pass" name="passScore" type="number" min={1} max={100} defaultValue={60} />
            </div>
            <div>
              <Label htmlFor="ex-time">Durée limite (min, optionnel)</Label>
              <Input id="ex-time" name="timeLimitMin" type="number" min={1} max={300} />
            </div>
            <div className="sm:col-span-2 flex items-center gap-2">
              <input id="ex-exam" name="isExam" type="checkbox" className="h-4 w-4 rounded border-night-300" />
              <Label htmlFor="ex-exam">Il s&apos;agit d&apos;un examen obligatoire</Label>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="ex-questions" required>Questions (JSON)</Label>
              <Textarea
                id="ex-questions"
                name="questions"
                required
                className="min-h-[140px] font-mono text-xs"
                defaultValue={`[\n  {\n    "id": "q1",\n    "prompt": "Question ?",\n    "choices": [\n      { "id": "a", "text": "Réponse A" },\n      { "id": "b", "text": "Réponse B" },\n      { "id": "c", "text": "Réponse C" }\n    ],\n    "correct": 0,\n    "explanation": "Pourquoi A est correct."\n  }\n]`}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" size="sm" loading={pending}>Créer l&apos;évaluation</Button>
            </div>
          </form>
        </details>
      </section>
    </div>
  );
}
