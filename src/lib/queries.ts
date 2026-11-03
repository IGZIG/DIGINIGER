import { createServerSupabase } from "@/lib/supabase/server";
import type {
  AiConversation,
  AiMessage,
  Attempt,
  Certificate,
  Course,
  Enrollment,
  Exercise,
  Lesson,
  LessonProgress,
  Module,
  Plan,
  Profile,
  PublicCourse,
  School,
  SafeExercise,
  Subscription,
  Transaction,
} from "@/types/database";

/**
 * Couche d'accès aux données (lecture).
 * Les politiques RLS filtrent déjà : ces requêtes ne peuvent pas fuiter de
 * données d'un autre utilisateur, même si un filtre était oublié ici.
 */

export async function listSchools(): Promise<School[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("schools")
    .select("*")
    .eq("is_active", true)
    .order("position");
  return (data ?? []) as School[];
}

export async function getSchoolBySlug(slug: string): Promise<School | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("schools").select("*").eq("slug", slug).maybeSingle();
  return (data as School) ?? null;
}

export interface CourseFilters {
  search?: string;
  school?: string;
  level?: string;
  maxPrice?: number;
  freeOnly?: boolean;
  sort?: "popular" | "rating" | "priceAsc" | "priceDesc" | "duration";
  limit?: number;
}

export async function listPublicCourses(filters: CourseFilters = {}): Promise<PublicCourse[]> {
  const supabase = await createServerSupabase();
  let query = supabase.from("public_courses").select("*");

  if (filters.school) query = query.eq("school_slug", filters.school);
  if (filters.level) query = query.eq("level", filters.level);
  if (filters.freeOnly) query = query.eq("is_free", true);
  if (typeof filters.maxPrice === "number") query = query.lte("price_xof", filters.maxPrice);
  if (filters.search) {
    const term = filters.search.replace(/[%,]/g, " ").trim();
    if (term) {
      query = query.or(
        `title_fr.ilike.%${term}%,subtitle_fr.ilike.%${term}%,school_name_fr.ilike.%${term}%,instructor_name.ilike.%${term}%`,
      );
    }
  }

  switch (filters.sort) {
    case "rating":
      query = query.order("rating_avg", { ascending: false });
      break;
    case "priceAsc":
      query = query.order("price_xof", { ascending: true });
      break;
    case "priceDesc":
      query = query.order("price_xof", { ascending: false });
      break;
    case "duration":
      query = query.order("duration_hours", { ascending: true });
      break;
    default:
      query = query.order("enrollment_count", { ascending: false });
  }

  query = query.limit(filters.limit ?? 60);

  const { data } = await query;
  return (data ?? []) as PublicCourse[];
}

export async function getPublicCourseBySlug(slug: string): Promise<PublicCourse | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("public_courses")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return (data as PublicCourse) ?? null;
}

export async function getCourseCurriculum(courseId: string) {
  const supabase = await createServerSupabase();
  const [{ data: modules }, { data: lessons }] = await Promise.all([
    supabase.from("modules").select("*").eq("course_id", courseId).order("position"),
    supabase
      .from("lessons")
      .select("*")
      .in(
        "module_id",
        (
          await supabase.from("modules").select("id").eq("course_id", courseId)
        ).data?.map((m) => m.id) ?? [],
      )
      .order("position"),
  ]);

  return {
    modules: (modules ?? []) as Module[],
    lessons: (lessons ?? []) as Lesson[],
  };
}

export async function listPlans(): Promise<Plan[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("position");
  return (data ?? []) as Plan[];
}

// ---------------------------------------------------------------------------
// Apprenant
// ---------------------------------------------------------------------------

export interface EnrolledCourse {
  enrollment: Enrollment;
  course: PublicCourse;
}

export async function listMyCourses(userId: string): Promise<EnrolledCourse[]> {
  const supabase = await createServerSupabase();
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("*")
    .eq("user_id", userId)
    .order("last_activity_at", { ascending: false });

  if (!enrollments?.length) return [];

  const { data: courses } = await supabase
    .from("public_courses")
    .select("*")
    .in("id", enrollments.map((e) => e.course_id));

  const byId = new Map((courses ?? []).map((c) => [c.id, c as PublicCourse]));

  return enrollments
    .map((enrollment) => ({
      enrollment: enrollment as Enrollment,
      course: byId.get(enrollment.course_id)!,
    }))
    .filter((row) => Boolean(row.course));
}

export async function getMyEnrollment(userId: string, courseId: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("enrollments")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();
  return (data as Enrollment) ?? null;
}

export async function getMyProgress(userId: string, courseId: string): Promise<LessonProgress[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("lesson_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId);
  return (data ?? []) as LessonProgress[];
}

export async function listMyExams(userId: string) {
  const supabase = await createServerSupabase();
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("course_id")
    .eq("user_id", userId);

  const courseIds = (enrollments ?? []).map((e) => e.course_id);
  if (!courseIds.length) return [] as Exercise[];

  const { data } = await supabase
    .from("exercises")
    .select("*")
    .in("course_id", courseIds)
    .eq("is_published", true)
    .order("is_exam", { ascending: false });
  return (data ?? []) as Exercise[];
}

export async function listMyAttempts(userId: string): Promise<(Attempt & { exercise?: Exercise })[]> {
  const supabase = await createServerSupabase();
  const { data: attempts } = await supabase
    .from("attempts")
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(50);

  if (!attempts?.length) return [];

  const { data: exercises } = await supabase
    .from("exercises")
    .select("*")
    .in("id", [...new Set(attempts.map((a) => a.exercise_id))]);

  const byId = new Map((exercises ?? []).map((e) => [e.id, e as Exercise]));
  return attempts.map((a) => ({ ...(a as Attempt), exercise: byId.get(a.exercise_id) }));
}

export async function listMyCertificates(userId: string): Promise<Certificate[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("certificates")
    .select("*")
    .eq("user_id", userId)
    .order("issued_at", { ascending: false });
  return (data ?? []) as Certificate[];
}

export async function listMyTransactions(userId: string): Promise<Transaction[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Transaction[];
}

export async function getMySubscription(userId: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("subscriptions")
    .select("*, plan:plans(*)")
    .eq("user_id", userId)
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .maybeSingle();
  return data as (Subscription & { plan: Plan }) | null;
}

export async function listMyConversations(userId: string): Promise<AiConversation[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(30);
  return (data ?? []) as AiConversation[];
}

export async function getConversationMessages(conversationId: string): Promise<AiMessage[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at");
  return (data ?? []) as AiMessage[];
}

/** Exercice « sûr » : les réponses correctes sont retirées avant l'envoi au client. */
export async function getSafeExercise(exerciseId: string): Promise<SafeExercise | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("exercises")
    .select("*")
    .eq("id", exerciseId)
    .eq("is_published", true)
    .maybeSingle();

  if (!data) return null;
  const exercise = data as Exercise;
  return {
    ...exercise,
    questions: exercise.questions.map(({ correct: _correct, explanation: _explanation, ...rest }) => rest),
  };
}

// ---------------------------------------------------------------------------
// Formateur & administration
// ---------------------------------------------------------------------------

export async function listCoursesForStaff(userId: string, isAdmin: boolean) {
  const supabase = await createServerSupabase();
  let query = supabase
    .from("courses")
    .select("*, school:schools(name_fr, slug), instructor:profiles!courses_instructor_id_fkey(full_name)")
    .order("updated_at", { ascending: false });

  if (!isAdmin) query = query.eq("instructor_id", userId);

  const { data } = await query;
  return data ?? [];
}

export async function listProfilesForAdmin(): Promise<Profile[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []) as Profile[];
}

export async function getCourseForEdit(courseId: string) {
  const supabase = await createServerSupabase();
  const [{ data: course }, { data: modules }, { data: exercises }] = await Promise.all([
    supabase.from("courses").select("*").eq("id", courseId).maybeSingle(),
    supabase.from("modules").select("*").eq("course_id", courseId).order("position"),
    supabase.from("exercises").select("*").eq("course_id", courseId).order("created_at"),
  ]);
  return {
    course: (course as Course) ?? null,
    modules: (modules ?? []) as Module[],
    exercises: (exercises ?? []) as Exercise[],
  };
}
