/**
 * Types de la base DIGINIGER.
 * Écrits à la main pour rester lisibles ; en production, régénérer avec :
 *   npx supabase gen types typescript --project-id dthflsyrhhbpoiecajun > src/types/database.ts
 */

export type UserRole = "student" | "instructor" | "admin";
export type CourseStatus = "draft" | "in_review" | "published" | "archived";
export type CourseLevel = "debutant" | "intermediaire" | "avance";
export type EnrollmentStatus = "active" | "completed" | "cancelled" | "expired";
export type LessonStatus = "not_started" | "in_progress" | "completed";
export type ExerciseKind = "quiz" | "open" | "project";
export type AttemptStatus = "in_progress" | "submitted" | "graded" | "expired";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "expired";
export type BillingInterval = "month" | "year" | "one_time";
export type PlanAudience = "individual" | "business";
export type PaymentProvider = "mobile_money" | "card" | "manual";
export type TransactionStatus = "pending" | "paid" | "failed" | "refunded" | "cancelled";
export type PromoKind = "percent" | "amount";
export type RefundStatusRequested = "requested" | "approved" | "refused" | "processed";
export type ApplicationKind = "instructor" | "enterprise" | "contact";
export type ApplicationStatusValue = "new" | "reviewing" | "accepted" | "rejected";
export type GenerationStatus = "queued" | "running" | "ready" | "failed" | "published" | "rejected";
export type ContentSource = "manual" | "ai_generated";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string;
  phone: string | null;
  country: string | null;
  city: string | null;
  bio: string | null;
  avatar_url: string | null;
  locale: "fr" | "en";
  role: UserRole;
  is_verified: boolean;
  onboarded_at: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface School {
  id: string;
  slug: string;
  name_fr: string;
  name_en: string;
  tagline_fr: string;
  tagline_en: string;
  description_fr: string;
  description_en: string;
  icon: string;
  accent: string;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  slug: string;
  school_id: string | null;
  instructor_id: string | null;
  title_fr: string;
  title_en: string | null;
  subtitle_fr: string;
  subtitle_en: string | null;
  description_fr: string;
  description_en: string | null;
  level: CourseLevel;
  status: CourseStatus;
  source: ContentSource;
  language: "fr" | "en";
  duration_hours: number;
  price_xof: number;
  is_free: boolean;
  is_featured: boolean;
  cover_gradient: string;
  cover_url: string | null;
  outcomes: string[];
  prerequisites: string[];
  audience: string[];
  rating_avg: number;
  rating_count: number;
  enrollment_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Ligne de la vue public.public_courses (catalogue public). */
export interface PublicCourse {
  id: string;
  slug: string;
  title_fr: string;
  title_en: string | null;
  subtitle_fr: string;
  subtitle_en: string | null;
  level: CourseLevel;
  language: "fr" | "en";
  duration_hours: number;
  price_xof: number;
  is_free: boolean;
  is_featured: boolean;
  cover_gradient: string;
  rating_avg: number;
  rating_count: number;
  enrollment_count: number;
  outcomes: string[];
  prerequisites: string[];
  audience: string[];
  published_at: string | null;
  school_slug: string | null;
  school_name_fr: string | null;
  school_name_en: string | null;
  school_accent: string | null;
  instructor_name: string | null;
  instructor_avatar: string | null;
  module_count: number;
  lesson_count: number;
}

export interface Module {
  id: string;
  course_id: string;
  title_fr: string;
  title_en: string | null;
  summary: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: string;
  module_id: string;
  title_fr: string;
  title_en: string | null;
  kind: "video" | "reading" | "exercise" | "project" | "live";
  content_md: string;
  video_url: string | null;
  duration_min: number;
  position: number;
  is_preview: boolean;
  created_at: string;
  updated_at: string;
}

export interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  status: EnrollmentStatus;
  progress_pct: number;
  source: "free" | "purchase" | "subscription" | "grant" | "business";
  enrolled_at: string;
  completed_at: string | null;
  last_activity_at: string;
}

export interface LessonProgress {
  id: string;
  user_id: string;
  course_id: string;
  lesson_id: string;
  status: LessonStatus;
  seconds_spent: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  choices: { id: string; text: string }[];
  /** Index de la bonne réponse — jamais envoyé au navigateur avant correction. */
  correct: number;
  explanation?: string;
  points?: number;
}

export interface Exercise {
  id: string;
  course_id: string;
  lesson_id: string | null;
  kind: ExerciseKind;
  title_fr: string;
  instructions: string;
  questions: QuizQuestion[];
  max_score: number;
  pass_score: number;
  time_limit_min: number | null;
  is_exam: boolean;
  is_published: boolean;
  source: ContentSource;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Version « apprenant » : sans les réponses correctes. */
export type SafeExercise = Omit<Exercise, "questions"> & {
  questions: Omit<QuizQuestion, "correct" | "explanation">[];
};

export interface Attempt {
  id: string;
  exercise_id: string;
  user_id: string;
  course_id: string;
  status: AttemptStatus;
  answers: Record<string, number | string>;
  score: number | null;
  feedback: string | null;
  grader: "auto" | "ai" | "instructor" | null;
  started_at: string;
  submitted_at: string | null;
  graded_at: string | null;
  expires_at: string | null;
}

export interface Certificate {
  id: string;
  serial: string;
  user_id: string;
  course_id: string;
  student_name: string;
  course_title: string;
  score: number | null;
  verification_hash: string;
  issued_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
  pdf_path: string | null;
}

export interface Plan {
  id: string;
  code: string;
  name_fr: string;
  name_en: string;
  description_fr: string;
  description_en: string;
  audience: PlanAudience;
  price_xof: number;
  interval: BillingInterval;
  features_fr: string[];
  features_en: string[];
  ai_messages_per_day: number;
  course_access: "free" | "all" | "premium";
  is_featured: boolean;
  is_active: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  provider: PaymentProvider | null;
  provider_ref: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  reference: string;
  user_id: string;
  plan_id: string | null;
  course_id: string | null;
  promo_code_id: string | null;
  amount_xof: number;
  discount_xof: number;
  total_xof: number;
  currency: string;
  provider: PaymentProvider;
  provider_ref: string | null;
  status: TransactionStatus;
  metadata: Record<string, unknown>;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Refund {
  id: string;
  transaction_id: string;
  user_id: string;
  amount_xof: number;
  reason: string;
  status: RefundStatusRequested;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
}

export interface ApplicationRequest {
  id: string;
  kind: ApplicationKind;
  user_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  organisation: string | null;
  subject: string | null;
  payload: Record<string, unknown>;
  status: ApplicationStatusValue;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiConversation {
  id: string;
  user_id: string;
  course_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AiMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: { title: string; chunk_id: string; similarity: number }[];
  tokens_in: number | null;
  tokens_out: number | null;
  model: string | null;
  created_at: string;
}

export interface CourseGeneration {
  id: string;
  created_by: string;
  school_id: string | null;
  course_id: string | null;
  prompt: Record<string, unknown>;
  result: GeneratedCourseDraft | null;
  status: GenerationStatus;
  error: string | null;
  model: string | null;
  tokens: number | null;
  created_at: string;
  updated_at: string;
}

export interface GeneratedCourseDraft {
  title: string;
  subtitle: string;
  description: string;
  level: CourseLevel;
  duration_hours: number;
  outcomes: string[];
  prerequisites: string[];
  audience: string[];
  modules: {
    title: string;
    summary: string;
    lessons: { title: string; kind: "video" | "reading" | "exercise"; content_md: string; duration_min: number }[];
  }[];
  exercises: {
    kind: ExerciseKind;
    title: string;
    instructions: string;
    is_exam: boolean;
    questions: QuizQuestion[];
  }[];
}

export interface AdminStats {
  students: number;
  instructors: number;
  courses_published: number;
  courses_draft: number;
  enrollments: number;
  completions: number;
  certificates: number;
  revenue_xof: number;
  active_subscriptions: number;
  ai_messages_today: number;
  pending_applications: number;
  revenue_by_month: { month: string; revenue: number }[];
  enrollments_by_school: { school: string; total: number }[];
}

export interface StudentProgressSummary {
  courses_enrolled: number;
  courses_completed: number;
  lessons_completed: number;
  minutes_learned: number;
  average_score: number;
  certificates: number;
}

export interface CertificateVerification {
  found: boolean;
  serial?: string;
  student_name?: string;
  course_title?: string;
  score?: number | null;
  issued_at?: string;
  is_valid?: boolean;
}
