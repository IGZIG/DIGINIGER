import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/auth";
import { isAiConfigured } from "@/lib/ai/tutor";
import { generateCourseSchema } from "@/lib/validation";
import type { GeneratedCourseDraft } from "@/types/database";

/**
 * POST /api/ai/generate-course
 * ---------------------------------------------------------------------------
 * Générateur de formations (module 4). Réservé aux formateurs et admins.
 * Produit une TRAME structurée, stockée en base au statut « ready ».
 * Aucune publication automatique : materializeDraftAction crée ensuite un
 * brouillon que l'humain doit relire et soumettre à validation.
 */
export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const role = user.profile?.role;
  if (role !== "instructor" && role !== "admin") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  if (!isAiConfigured()) {
    return NextResponse.json(
      {
        error: "AI_NOT_CONFIGURED",
        message:
          "La clé du fournisseur de modèles n'est pas configurée : la génération de contenu est désactivée.",
      },
      { status: 503 },
    );
  }

  const admin = createAdminClient();

  // Limitation : 5 générations par heure et par formateur
  const { data: allowed } = await admin.rpc("take_rate_limit", {
    p_key: `generate:${user.authId}`,
    p_limit: 5,
    p_window_seconds: 3600,
  });
  if (allowed === false) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Limite de générations atteinte pour cette heure." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = generateCourseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: parsed.error.errors[0].message },
      { status: 422 },
    );
  }

  const { schoolId, topic, level, durationHours, audience, objectives } = parsed.data;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 90_000 });
  const model = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";

  const prompt = `Tu es ingénieur pédagogique pour DIGINIGER, académie professionnelle du Niger et d'Afrique de l'Ouest.

Conçois la trame d'une formation professionnelle.

Sujet : ${topic}
Niveau : ${level}
Durée visée : ${durationHours} heures
Public : ${audience || "professionnels et étudiants de la sous-région"}
Objectifs exprimés : ${objectives || "non précisés"}

Contraintes :
- français simple, exemples ancrés au Niger / Afrique de l'Ouest (FCFA, contexte local) ;
- 3 à 5 modules, 2 à 4 leçons par module (kind: "video" | "reading" | "exercise") ;
- contenus de leçon de 120 à 400 mots en markdown simple (## titres, listes) ;
- 2 évaluations : un quiz d'entraînement (is_exam false) et un examen final (is_exam true) ;
- chaque question : 3 choix, une seule bonne réponse, champ "correct" = index (0,1,2), et une "explanation" courte ;
- identifiants de questions uniques ("q1", "q2"…) et de choix ("a","b","c").

Réponds STRICTEMENT en JSON valide, sans texte autour, au format :
{
  "title": string,
  "subtitle": string,
  "description": string,
  "level": "debutant"|"intermediaire"|"avance",
  "duration_hours": number,
  "outcomes": string[],
  "prerequisites": string[],
  "audience": string[],
  "modules": [{ "title": string, "summary": string, "lessons": [{ "title": string, "kind": "video"|"reading"|"exercise", "content_md": string, "duration_min": number }] }],
  "exercises": [{ "kind": "quiz", "title": string, "instructions": string, "is_exam": boolean, "questions": [{ "id": string, "prompt": string, "choices": [{ "id": string, "text": string }], "correct": number, "explanation": string }] }]
}`;

  let draft: GeneratedCourseDraft;

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "Tu réponds uniquement par du JSON valide, sans balises markdown." },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 3500,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    draft = validateDraft(JSON.parse(raw));

    // Enregistrement de la génération (traçabilité + coûts)
    const { data: generation } = await admin
      .from("course_generations")
      .insert({
        created_by: user.authId,
        school_id: schoolId,
        prompt: { topic, level, durationHours, audience, objectives },
        result: draft,
        status: "ready",
        model: completion.model,
        tokens: completion.usage?.total_tokens ?? 0,
      })
      .select("id")
      .single();

    return NextResponse.json({ generationId: generation?.id, draft, model: completion.model });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "INVALID_DRAFT"
        ? "Le modèle a renvoyé un contenu incomplet. Relancez la génération."
        : "La génération a échoué. Réessayez dans quelques instants.";

    await admin.from("course_generations").insert({
      created_by: user.authId,
      school_id: schoolId,
      prompt: { topic, level, durationHours, audience, objectives },
      status: "failed",
      error: error instanceof Error ? error.message.slice(0, 500) : "unknown",
      model,
    });

    return NextResponse.json({ error: "GENERATION_FAILED", message }, { status: 502 });
  }
}

const draftSchema = z.object({
  title: z.string().min(4),
  subtitle: z.string().default(""),
  description: z.string().default(""),
  level: z.enum(["debutant", "intermediaire", "avance"]),
  duration_hours: z.coerce.number().min(1).max(300),
  outcomes: z.array(z.string()).default([]),
  prerequisites: z.array(z.string()).default([]),
  audience: z.array(z.string()).default([]),
  modules: z
    .array(
      z.object({
        title: z.string(),
        summary: z.string().default(""),
        lessons: z
          .array(
            z.object({
              title: z.string(),
              kind: z.enum(["video", "reading", "exercise"]).default("reading"),
              content_md: z.string().default(""),
              duration_min: z.coerce.number().min(1).max(300).default(15),
            }),
          )
          .default([]),
      }),
    )
    .min(1),
  exercises: z
    .array(
      z.object({
        kind: z.enum(["quiz", "open", "project"]).default("quiz"),
        title: z.string(),
        instructions: z.string().default(""),
        is_exam: z.boolean().default(false),
        questions: z
          .array(
            z.object({
              id: z.string(),
              prompt: z.string(),
              choices: z.array(z.object({ id: z.string(), text: z.string() })).min(2),
              correct: z.coerce.number().int().min(0).max(10),
              explanation: z.string().optional(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});

/** Validation stricte : on refuse tout brouillon inexploitable. */
function validateDraft(input: unknown): GeneratedCourseDraft {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) throw new Error("INVALID_DRAFT");

  const draft = parsed.data;

  // Vérifie que l'index "correct" pointe bien sur un choix existant
  for (const exercise of draft.exercises) {
    for (const question of exercise.questions) {
      if (question.correct >= question.choices.length) throw new Error("INVALID_DRAFT");
    }
  }
  if (draft.modules.every((module) => module.lessons.length === 0)) {
    throw new Error("INVALID_DRAFT");
  }

  return draft as GeneratedCourseDraft;
}

export const dynamic = "force-dynamic";
export const maxDuration = 120;
