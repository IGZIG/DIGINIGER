import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/auth";
import { aiChatSchema } from "@/lib/validation";
import { askTutor, isAiConfigured, retrieveContext } from "@/lib/ai/tutor";

/**
 * POST /api/ai/chat — DIGINIGER AI Tutor
 * ---------------------------------------------------------------------------
 * Sécurité et coûts :
 *  - session obligatoire (401 sinon) ;
 *  - quota quotidien par offre, décrémenté atomiquement (RPC consume_ai_quota) ;
 *  - rate limiting par utilisateur (10 requêtes / 5 min) ;
 *  - accès au cours vérifié en base (can_access_course) ;
 *  - contexte limité aux documents validés du cours (RAG) ;
 *  - messages enregistrés en service_role (le client ne peut pas écrire l'historique).
 */
export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  if (!isAiConfigured()) {
    // Dégradation honnête : pas de réponse inventée.
    return NextResponse.json(
      {
        error: "AI_NOT_CONFIGURED",
        message:
          "Le tuteur IA n'est pas encore activé sur cette installation (clé OpenAI absente). Aucune réponse n'est simulée.",
      },
      { status: 503 },
    );
  }

  const admin = createAdminClient();

  // --- Rate limiting anti-abus --------------------------------------------
  const { data: withinLimit } = await admin.rpc("take_rate_limit", {
    p_key: `ai:${user.authId}`,
    p_limit: 10,
    p_window_seconds: 300,
  });
  if (withinLimit === false) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Trop de questions en peu de temps. Patientez quelques minutes." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = aiChatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: parsed.error.errors[0].message },
      { status: 422 },
    );
  }

  const { message, courseId, conversationId } = parsed.data;
  const supabase = await createServerSupabase();

  // --- Quota selon l'offre active ----------------------------------------
  const { data: planData } = await supabase.rpc("my_active_plan");
  const plan = Array.isArray(planData) ? planData[0] : planData;
  const dailyLimit = plan?.ai_messages_per_day ?? 10; // offre gratuite par défaut

  const { data: quotaOk } = await admin.rpc("consume_ai_quota", {
    p_user_id: user.authId,
    p_limit: dailyLimit,
    p_tokens: 0,
  });

  if (quotaOk === false) {
    return NextResponse.json(
      {
        error: "AI_QUOTA_EXCEEDED",
        message: `Quota quotidien atteint (${dailyLimit} messages). Passez à une offre supérieure pour continuer.`,
      },
      { status: 429 },
    );
  }

  // --- Contexte pédagogique ----------------------------------------------
  let courseTitle: string | null = null;
  let level: "debutant" | "intermediaire" | "avance" | null = null;
  let chunks: Awaited<ReturnType<typeof retrieveContext>> = [];

  if (courseId) {
    // Vérifie l'accès réel (inscription, formateur ou admin)
    const { data: canAccess } = await supabase.rpc("can_access_course", {
      p_course_id: courseId,
    });

    if (!canAccess) {
      return NextResponse.json(
        { error: "COURSE_ACCESS_DENIED", message: "Vous n'avez pas accès à cette formation." },
        { status: 403 },
      );
    }

    const { data: course } = await supabase
      .from("courses")
      .select("title_fr, level")
      .eq("id", courseId)
      .maybeSingle();

    courseTitle = course?.title_fr ?? null;
    level = (course?.level as typeof level) ?? null;

    try {
      chunks = await retrieveContext(admin, courseId, message);
    } catch {
      chunks = []; // une erreur d'embedding ne doit pas bloquer la réponse
    }
  }

  // --- Conversation -------------------------------------------------------
  let activeConversationId = conversationId ?? null;

  if (activeConversationId) {
    const { data: conversation } = await supabase
      .from("ai_conversations")
      .select("id, user_id")
      .eq("id", activeConversationId)
      .maybeSingle();

    if (!conversation || conversation.user_id !== user.authId) {
      return NextResponse.json({ error: "CONVERSATION_NOT_FOUND" }, { status: 404 });
    }
  } else {
    const { data: created, error: createError } = await supabase
      .from("ai_conversations")
      .insert({
        user_id: user.authId,
        course_id: courseId ?? null,
        title: message.slice(0, 60),
      })
      .select("id")
      .single();

    if (createError || !created) {
      return NextResponse.json({ error: "CONVERSATION_CREATE_FAILED" }, { status: 500 });
    }
    activeConversationId = created.id;
  }

  // Historique récent (contexte de conversation)
  const { data: historyRows } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", activeConversationId)
    .order("created_at", { ascending: false })
    .limit(8);

  const history = (historyRows ?? [])
    .reverse()
    .filter((row) => row.role === "user" || row.role === "assistant")
    .map((row) => ({ role: row.role as "user" | "assistant", content: row.content }));

  // Score récents pour adapter le discours
  const { data: attempts } = await supabase
    .from("attempts")
    .select("score")
    .eq("user_id", user.authId)
    .not("score", "is", null)
    .order("started_at", { ascending: false })
    .limit(5);

  // --- Appel du modèle ----------------------------------------------------
  let answer;
  try {
    answer = await askTutor(
      {
        studentName: user.profile?.full_name ?? "",
        level,
        courseTitle,
        lessonTitle: null,
        recentScores: (attempts ?? []).map((row) => row.score as number),
        chunks,
      },
      history,
      message,
    );
  } catch {
    return NextResponse.json(
      { error: "AI_PROVIDER_ERROR", message: "Le tuteur est momentanément indisponible. Réessayez." },
      { status: 502 },
    );
  }

  // --- Persistance (service_role) ----------------------------------------
  await admin.from("ai_messages").insert([
    {
      conversation_id: activeConversationId,
      user_id: user.authId,
      role: "user",
      content: message,
    },
    {
      conversation_id: activeConversationId,
      user_id: user.authId,
      role: "assistant",
      content: answer.content,
      citations: answer.citations,
      tokens_in: answer.tokensIn,
      tokens_out: answer.tokensOut,
      model: answer.model,
    },
  ]);

  await admin
    .from("ai_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", activeConversationId);

  // Consommation réelle en jetons (traçabilité des coûts)
  await admin.rpc("consume_ai_quota", {
    p_user_id: user.authId,
    p_limit: dailyLimit + 1000,
    p_tokens: answer.tokensIn + answer.tokensOut,
  });

  await admin.from("audit_logs").insert({
    actor_id: user.authId,
    action: "ai.message",
    entity: "ai_conversations",
    entity_id: activeConversationId,
    metadata: {
      course_id: courseId ?? null,
      chunks: chunks.length,
      model: answer.model,
      tokens: answer.tokensIn + answer.tokensOut,
    },
  });

  return NextResponse.json({
    conversationId: activeConversationId,
    content: answer.content,
    citations: answer.citations,
    model: answer.model,
  });
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;
