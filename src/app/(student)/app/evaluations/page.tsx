import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, Award, ArrowRight } from "lucide-react";
import { EmptyState } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { listMyAttempts, listMyExams } from "@/lib/queries";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Exercices & examens" };
export const dynamic = "force-dynamic";

export default async function EvaluationsPage() {
  const user = await requireUser("/app/evaluations");
  const [exercises, attempts] = await Promise.all([
    listMyExams(user.authId),
    listMyAttempts(user.authId),
  ]);

  const bestByExercise = attempts.reduce<Record<string, number>>((acc, attempt) => {
    if (attempt.score != null) {
      acc[attempt.exercise_id] = Math.max(acc[attempt.exercise_id] ?? 0, attempt.score);
    }
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold">Évaluations disponibles ({exercises.length})</h2>
        <p className="text-sm text-night-400">
          Les exercices sont corrigés automatiquement côté serveur. Les examens conditionnent
          l&apos;obtention du certificat.
        </p>

        {exercises.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              icon={<ClipboardCheck className="h-5 w-5" />}
              title="Aucune évaluation disponible"
              description="Les évaluations apparaissent ici dès que vous êtes inscrit à une formation qui en contient."
              action={<ButtonLink href="/app/catalogue" variant="outline">Explorer le catalogue</ButtonLink>}
            />
          </div>
        ) : (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {exercises.map((exercise) => {
              const best = bestByExercise[exercise.id];
              return (
                <li key={exercise.id}>
                  <Link
                    href={`/app/evaluations/${exercise.id}`}
                    className="group flex items-center justify-between gap-3 rounded-2xl border border-night-100 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-card"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {exercise.is_exam ? (
                          <Badge tone="night">
                            <Award className="h-3 w-3" aria-hidden />
                            Examen
                          </Badge>
                        ) : (
                          <Badge tone="electric">Exercice</Badge>
                        )}
                        {best != null && (
                          <Badge tone={best >= exercise.pass_score ? "green" : "gold"}>
                            Meilleur : {best} %
                          </Badge>
                        )}
                      </div>
                      <p className="mt-2 truncate text-sm font-semibold text-night-800 group-hover:text-electric-600">
                        {exercise.title_fr}
                      </p>
                      <p className="mt-0.5 text-xs text-night-400">
                        {exercise.questions.length} questions · seuil {exercise.pass_score}/100
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-night-300 transition-transform group-hover:translate-x-1" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Historique des résultats</h2>
        {attempts.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              icon={<Award className="h-5 w-5" />}
              title="Aucun résultat pour l'instant"
              description="Vos tentatives et leurs scores s'afficheront ici."
            />
          </div>
        ) : (
          <div className="mt-5 overflow-hidden rounded-2xl border border-night-100 bg-white">
            <table className="w-full text-sm">
              <caption className="sr-only">Historique de vos évaluations</caption>
              <thead className="bg-mist text-left text-xs uppercase tracking-wider text-night-400">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Évaluation</th>
                  <th scope="col" className="hidden px-4 py-3 font-medium sm:table-cell">Date</th>
                  <th scope="col" className="px-4 py-3 font-medium">Score</th>
                  <th scope="col" className="px-4 py-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-night-100">
                {attempts.map((attempt) => (
                  <tr key={attempt.id}>
                    <td className="px-4 py-3">
                      <span className="font-medium text-night-800">
                        {attempt.exercise?.title_fr ?? "Évaluation supprimée"}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-night-400 sm:table-cell">
                      {formatDateTime(attempt.submitted_at ?? attempt.started_at)}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {attempt.score != null ? `${attempt.score} %` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {attempt.status === "graded" && attempt.exercise ? (
                        <Badge tone={attempt.score! >= attempt.exercise.pass_score ? "green" : "red"}>
                          {attempt.score! >= attempt.exercise.pass_score ? "Réussi" : "Échoué"}
                        </Badge>
                      ) : attempt.status === "submitted" ? (
                        <Badge tone="gold">En correction</Badge>
                      ) : (
                        <Badge tone="neutral">En cours</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
