"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  PenLine,
  PlayCircle,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Progress, Alert } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { completeLessonAction } from "@/lib/actions/learning";
import { cn } from "@/lib/utils";
import type { Lesson, Module, LessonProgress } from "@/types/database";

const KIND_ICONS = {
  video: PlayCircle,
  reading: FileText,
  exercise: PenLine,
  project: Layers,
  live: Clock,
} as const;

const KIND_LABELS = {
  video: "Vidéo",
  reading: "Lecture",
  exercise: "Exercice",
  project: "Projet",
  live: "Session live",
} as const;

/**
 * Lecteur de cours : navigation leçon par leçon, validation de progression
 * enregistrée en base via une Server Action (RPC complete_lesson).
 */
export function LessonPlayer({
  courseId,
  courseSlug,
  modules,
  lessons,
  progress,
  initialLessonId,
}: {
  courseId: string;
  courseSlug: string;
  modules: Module[];
  lessons: Lesson[];
  progress: LessonProgress[];
  initialLessonId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [currentId, setCurrentId] = useState<string>(
    initialLessonId ?? lessons.find((l) => l.is_preview)?.id ?? lessons[0]?.id ?? "",
  );

  const completedIds = useMemo(
    () => new Set(progress.filter((p) => p.status === "completed").map((p) => p.lesson_id)),
    [progress],
  );

  const orderedLessons = useMemo(() => lessons, [lessons]);
  const currentIndex = orderedLessons.findIndex((lesson) => lesson.id === currentId);
  const current = orderedLessons[currentIndex] ?? orderedLessons[0];
  const completedCount = orderedLessons.filter((lesson) => completedIds.has(lesson.id)).length;
  const progressPct = orderedLessons.length
    ? Math.round((completedCount / orderedLessons.length) * 100)
    : 0;

  const isCompleted = current ? completedIds.has(current.id) : false;

  function markComplete() {
    if (!current) return;
    setError(null);
    startTransition(async () => {
      const result = await completeLessonAction(current.id, Math.round((current.duration_min || 10) * 60));
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const next = orderedLessons[currentIndex + 1];
      if (next) setCurrentId(next.id);
      router.refresh();
    });
  }

  if (!current) {
    return <Alert tone="info">Aucune leçon n&apos;est encore publiée pour cette formation.</Alert>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* Sommaire */}
      <aside className="order-2 rounded-2xl border border-night-100 bg-white lg:order-1">
        <div className="border-b border-night-100 p-4">
          <p className="text-sm font-semibold">Contenu du cours</p>
          <Progress value={progressPct} className="mt-2.5" label={`${completedCount}/${orderedLessons.length} leçons`} />
        </div>
        <nav className="max-h-[560px] overflow-y-auto p-2" aria-label="Sommaire du cours">
          {modules.map((module, moduleIndex) => {
            const moduleLessons = orderedLessons.filter((lesson) => lesson.module_id === module.id);
            return (
              <div key={module.id} className="mb-1">
                <p className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-night-300">
                  {moduleIndex + 1}. {module.title_fr}
                </p>
                <ul>
                  {moduleLessons.map((lesson) => {
                    const Icon = KIND_ICONS[lesson.kind] ?? PlayCircle;
                    const done = completedIds.has(lesson.id);
                    const active = lesson.id === current.id;
                    return (
                      <li key={lesson.id}>
                        <button
                          type="button"
                          onClick={() => setCurrentId(lesson.id)}
                          className={cn(
                            "flex w-full items-start gap-2.5 rounded-xl px-2 py-2.5 text-left text-sm transition-colors",
                            active ? "bg-electric-50 text-electric-800" : "hover:bg-night-50",
                          )}
                          aria-current={active ? "true" : undefined}
                        >
                          {done ? (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-label="Terminée" />
                          ) : (
                            <Circle className="mt-0.5 h-4 w-4 shrink-0 text-night-200" aria-hidden />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className={cn("block leading-snug", active ? "font-medium" : "text-night-600")}>
                              {lesson.title_fr}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1 text-[11px] text-night-300">
                              <Icon className="h-3 w-3" aria-hidden />
                              {KIND_LABELS[lesson.kind]} · {lesson.duration_min} min
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Contenu de la leçon */}
      <section className="order-1 lg:order-2">
        <div className="rounded-2xl border border-night-100 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-night-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <Badge tone="electric">{KIND_LABELS[current.kind]}</Badge>
              <span className="text-xs text-night-400">{current.duration_min} min</span>
            </div>
            {isCompleted && <Badge tone="green">Terminée</Badge>}
          </div>

          <div className="p-5 sm:p-7">
            <h2 className="text-xl font-semibold">{current.title_fr}</h2>

            {current.kind === "video" && (
              <div className="mt-5 flex aspect-video items-center justify-center rounded-2xl bg-night-900">
                {current.video_url ? (
                  <video
                    controls
                    preload="metadata"
                    className="h-full w-full rounded-2xl"
                    src={current.video_url}
                  >
                    Votre navigateur ne prend pas en charge la vidéo.
                  </video>
                ) : (
                  <div className="px-6 text-center text-white/60">
                    <PlayCircle className="mx-auto h-10 w-10 text-white/30" aria-hidden />
                    <p className="mt-3 text-sm">
                      La vidéo de cette leçon n&apos;est pas encore téléversée.
                    </p>
                    <p className="mt-1 text-xs text-white/30">
                      Le texte ci-dessous reste disponible hors connexion vidéo.
                    </p>
                  </div>
                )}
              </div>
            )}

            <article className="prose-diginiger mt-6">
              {current.content_md
                ? current.content_md.split("\n").map((line, index) => {
                    if (line.startsWith("# ")) return <h1 key={index}>{line.slice(2)}</h1>;
                    if (line.startsWith("## ")) return <h2 key={index}>{line.slice(3)}</h2>;
                    if (line.trim() === "") return null;
                    return <p key={index}>{line}</p>;
                  })
                : <p className="text-sm text-night-400">Le contenu de cette leçon sera bientôt disponible.</p>}
            </article>

            {error && <div className="mt-4"><Alert tone="error">{error}</Alert></div>}

            <div className="mt-8 flex flex-col gap-2 border-t border-night-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentIndex <= 0}
                  onClick={() => setCurrentId(orderedLessons[currentIndex - 1].id)}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentIndex >= orderedLessons.length - 1}
                  onClick={() => setCurrentId(orderedLessons[currentIndex + 1].id)}
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Button>
              </div>

              <div className="flex gap-2">
                <ButtonLink
                  href={`/app/tuteur-ia?course=${courseId}&lesson=${current.id}`}
                  variant="ghost"
                  size="sm"
                >
                  <Sparkles className="h-4 w-4" aria-hidden />
                  Demander au tuteur
                </ButtonLink>
                <Button size="sm" onClick={markComplete} loading={pending} disabled={isCompleted}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  {isCompleted ? "Leçon terminée" : "Marquer comme terminée"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
