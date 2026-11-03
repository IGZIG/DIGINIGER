import { NextResponse } from "next/server";
import { isAiConfigured } from "@/lib/ai/tutor";

/** État public du tuteur IA (sans révéler de configuration sensible). */
export async function GET() {
  return NextResponse.json({
    configured: isAiConfigured(),
    model: isAiConfigured() ? (process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini") : null,
  });
}
