import type { Metadata } from "next";
import { AiChat } from "@/components/dashboard/ai-chat";
import { requireUser } from "@/lib/auth";
import { listMyConversations, listMyCourses } from "@/lib/queries";
import { isAiConfigured } from "@/lib/ai/tutor";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata = { title: "Tuteur IA" };
export const dynamic = "force-dynamic";

export default async function TutorPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; conversation?: string }>;
}) {
  const user = await requireUser("/app/tuteur-ia");
  const params = await searchParams;

  const [conversations, enrollments] = await Promise.all([
    listMyConversations(user.authId),
    listMyCourses(user.authId),
  ]);

  const supabase = await createServerSupabase();

  // Quota : offre active, sinon offre gratuite
  const { data: planData } = await supabase.rpc("my_active_plan");
  const plan = Array.isArray(planData) ? planData[0] : planData;
  const limit = plan?.ai_messages_per_day ?? 10;

  const { data: usage } = await supabase
    .from("ai_usage")
    .select("messages")
    .eq("user_id", user.authId)
    .eq("day", new Date().toISOString().slice(0, 10))
    .maybeSingle();

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Tuteur IA</h2>
        <p className="text-sm text-night-400">
          Un assistant pédagogique qui s&apos;appuie sur les documents validés de vos formations.
        </p>
      </div>

      <AiChat
        configured={isAiConfigured()}
        conversations={conversations.map((conversation) => ({
          id: conversation.id,
          title: conversation.title,
        }))}
        courses={enrollments.map(({ course }) => ({ id: course.id, title: course.title_fr }))}
        defaultCourseId={params.course}
        quota={{ used: usage?.messages ?? 0, limit }}
      />
    </div>
  );
}
