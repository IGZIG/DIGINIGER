"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock, CheckCircle2, XCircle, AlertTriangle, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress, Alert } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { startAttemptAction, submitAttemptAction } from "@/lib/actions/learning";
import { cn } from "@/lib/utils";
import type { SafeExercise, Attempt } from "@/types/database";

/**
 * Passation d'un exercice ou d'un examen.
 * Les réponses correctes ne sont JAMAIS envoyées au navigateur : la correction
 * (et donc le score) est calculée par la fonction SQL submit_attempt().
 */
export function ExamRunner({
  exercise,
  existingAttempts,
}: {
  exercise: SafeExercise;
  existingAttempts: Pick<Attempt, "id" | "score" | "status" | "submitted_at" | "feedback">[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<
    { score: number | null; passed: boolean; correct: number; total: number; pendingReview: boolean } | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(
    exercise.time_limit_min ? exercise.time_limit_min * 60 : null,
  );

  const gradedAttempts = existingAttempts.filter((a) => a.status === "graded");
  const bestScore = gradedAttempts.length
    ? Math.max(...gradedAttempts.map((a) => a.score ?? 0))
    : null;
  const examLocked = exercise.is_exam && existingAttempts.length >= 5;

  // Chronomètre local (indicatif) : la limite réelle est vérifiée côté base
  // via expires_at lors de la soumission.
  useEffect(() => {
    if (secondsLeft === null || !attemptId || result) return;
    if (secondsLeft <= 0) {
      handleSubmit();
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((value) => (value ?? 1) - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, attemptId, result]);

  function begin() {
    setError(null);
    startTransition(async () => {
      const response = await startAttemptAction(exercise.id);
      if (!response.ok) {
        setError(response.message);
        return;
      }
      setAttemptId(response.data.attemptId);
      setAnswers({});
      setResult(null);
    });
  }

  function handleSubmit() {
    if (!attemptId) return;
    setError(null);
    startTransition(async () => {
      const response = await submitAttemptAction(attemptId, answers);
      if (!response.ok) {
        setError(response.message);
        return;
      }
      setResult(response.data);
      router.refresh();
    });
  }

  const answeredCount = Object.keys(answers).length;

  // ---------------- Résultat ----------------
  if (result) {
    return (
      <div className="rounded-2xl border border-night-100 bg-white p-6 sm:p-8">
        <div className="text-center">
          {result.pendingReview ? (
            <Badge tone="gold">En attente d&apos;évaluation</Badge>
          ) : result.passed ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Réussi
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
              <XCircle className="h-4 w-4" aria-hidden />
              Non validé
            </span>
          )}

          {!result.pendingReview && (
            <>
              <p className="mt-5 font-display text-5xl font-bold">{result.score} %</p>
              <p className="mt-1 text-sm text-night-400">
                {result.correct} / {result.total} réponses correctes · seuil de réussite{" "}
                {exercise.pass_score} %
              </p>
              <Progress
                value={result.score ?? 0}
                className="mx-auto mt-4 max-w-xs"
                tone={result.passed ? "green" : "gold"}
              />
            </>
          )}

          {result.pendingReview && (
            <p className="mx-auto mt-4 max-w-md text-sm text-night-500">
              Votre travail a été envoyé. Il sera évalué par un formateur ; vous serez notifié dès
              que le résultat sera disponible.
            </p>
          )}
        </div>

        <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
          <Button
            onClick={() => {
              setResult(null);
              setAttemptId(null);
              begin();
            }}
            variant={result.passed ? "outline" : "primary"}
            loading={pending}
          >
            Repasser l&apos;évaluation
          </Button>
          <Button variant="ghost" onClick={() => router.push("/app/evaluations")}>
            Retour aux évaluations
          </Button>
        </div>
      </div>
    );
  }

  // ---------------- Introduction ----------------
  if (!attemptId) {
    return (
      <div className="rounded-2xl border border-night-100 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          {exercise.is_exam ? <Badge tone="night">Examen</Badge> : <Badge tone="electric">Exercice</Badge>}
          <Badge tone="neutral">{exercise.questions.length} questions</Badge>
          {exercise.time_limit_min && (
            <Badge tone="gold">
              <Clock className="h-3 w-3" aria-hidden />
              {exercise.time_limit_min} min
            </Badge>
          )}
        </div>

        <h2 className="mt-4 text-xl font-semibold">{exercise.title_fr}</h2>
        <p className="mt-2 text-sm leading-relaxed text-night-500">
          {exercise.instructions || "Répondez à toutes les questions, puis validez pour connaître votre score."}
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div className="rounded-xl bg-mist p-3">
            <dt className="text-xs text-night-400">Seuil de réussite</dt>
            <dd className="mt-0.5 font-semibold">{exercise.pass_score} / 100</dd>
          </div>
          <div className="rounded-xl bg-mist p-3">
            <dt className="text-xs text-night-400">Tentatives</dt>
            <dd className="mt-0.5 font-semibold">
              {existingAttempts.length}
              {exercise.is_exam ? " / 5" : ""}
            </dd>
          </div>
          <div className="rounded-xl bg-mist p-3">
            <dt className="text-xs text-night-400">Meilleur score</dt>
            <dd className="mt-0.5 font-semibold">{bestScore != null ? `${bestScore} %` : "—"}</dd>
          </div>
          <div className="rounded-xl bg-mist p-3">
            <dt className="text-xs text-night-400">Correction</dt>
            <dd className="mt-0.5 font-semibold">Serveur</dd>
          </div>
        </dl>

        {error && <div className="mt-5"><Alert tone="error">{error}</Alert></div>}

        {examLocked ? (
          <div className="mt-6">
            <Alert tone="warning" title="Limite de tentatives atteinte">
              Vous avez utilisé vos 5 tentatives pour cet examen. Contactez votre formateur pour
              une réouverture.
            </Alert>
          </div>
        ) : (
          <Button size="lg" className="mt-6 w-full sm:w-auto" onClick={begin} loading={pending}>
            {existingAttempts.length ? "Repasser l'évaluation" : "Commencer l'évaluation"}
          </Button>
        )}
      </div>
    );
  }

  // ---------------- Passation ----------------
  return (
    <div className="rounded-2xl border border-night-100 bg-white">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b border-night-100 bg-white/95 px-5 py-3 backdrop-blur">
        <div>
          <p className="text-sm font-semibold">{exercise.title_fr}</p>
          <p className="text-xs text-night-400">
            {answeredCount} / {exercise.questions.length} questions répondues
          </p>
        </div>
        <div className="flex items-center gap-3">
          {secondsLeft !== null && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                secondsLeft < 60 ? "bg-red-50 text-red-700" : "bg-mist text-night-600",
              )}
            >
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
            </span>
          )}
          <Button size="sm" onClick={handleSubmit} loading={pending}>
            Valider mes réponses
          </Button>
        </div>
      </div>

      <div className="space-y-6 p-5 sm:p-7">
        {error && <Alert tone="error">{error}</Alert>}

        {exercise.questions.map((question, index) => (
          <fieldset key={question.id} className="rounded-2xl border border-night-100 p-4">
            <legend className="px-1 text-sm font-semibold text-night-800">
              {index + 1}. {question.prompt}
            </legend>
            <div className="mt-3 space-y-2">
              {question.choices.map((choice, choiceIndex) => (
                <label
                  key={choice.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm transition-colors",
                    answers[question.id] === choiceIndex
                      ? "border-electric-500 bg-electric-50/60"
                      : "border-night-100 hover:border-night-200",
                  )}
                >
                  <input
                    type="radio"
                    name={question.id}
                    checked={answers[question.id] === choiceIndex}
                    onChange={() => setAnswers((current) => ({ ...current, [question.id]: choiceIndex }))}
                    className="mt-0.5 h-4 w-4 text-electric-500"
                  />
                  <span className="text-night-600">{choice.text}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <div className="flex items-center justify-between gap-3 border-t border-night-100 pt-4">
          <p className="flex items-center gap-1.5 text-xs text-night-400">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            Vos réponses sont enregistrées uniquement à la validation.
          </p>
          <Button onClick={handleSubmit} loading={pending}>
            Valider mes réponses
          </Button>
        </div>
      </div>
    </div>
  );
}
