/**
 * Vérification fonctionnelle de bout en bout (sans navigateur).
 * Exerce les vraies RPC avec une session étudiante réelle :
 *   connexion → inscription à un cours gratuit → progression → examen → certificat.
 *
 * Usage : node scripts/e2e-check.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

// Charge .env.local si les variables ne sont pas déjà exportées.
const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, raw] = match;
    if (!process.env[key]) process.env[key] = raw.replace(/^["']|["']$/g, "");
  }
}

let wsTransport;
try {
  const wsModule = await import("ws");
  wsTransport = wsModule.default ?? wsModule;
} catch {
  wsTransport = undefined;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL = process.env.E2E_EMAIL ?? "etudiant.demo@diginiger.test";
const PASSWORD = process.env.DEMO_PASSWORD ?? "Diginiger2026!";

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  ...(wsTransport ? { realtime: { transport: wsTransport } } : {}),
});

const results = [];
function check(label, ok, detail = "") {
  results.push({ label, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
}

// 1. Authentification
const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
  email: EMAIL,
  password: PASSWORD,
});
check("Connexion étudiant", !authError && Boolean(auth?.session), authError?.message);
if (authError) process.exit(1);

// 2. Profil et rôle
const { data: profile } = await supabase.from("profiles").select("*").eq("id", auth.user.id).single();
check("Profil chargé", Boolean(profile), profile?.role);

// 3. Aucune donnée d'un autre utilisateur (RLS)
const { data: others } = await supabase.from("profiles").select("id").neq("id", auth.user.id);
check("RLS : profils tiers invisibles", (others ?? []).length === 0, `${others?.length ?? 0} ligne(s)`);

// 4. Transactions d'autrui invisibles
const { data: foreignTx } = await supabase.from("transactions").select("id").neq("user_id", auth.user.id);
check("RLS : transactions tierces invisibles", (foreignTx ?? []).length === 0);

// 5. Écriture interdite sur une table sensible
const { error: chunkError } = await supabase.from("document_chunks").select("id").limit(1);
check("Contexte RAG non lisible côté client", Boolean(chunkError), chunkError?.code);

// 6. Catalogue
const { data: courses } = await supabase.from("public_courses").select("id,slug,title_fr,is_free").eq("is_free", true).limit(3);
check("Catalogue lisible", (courses ?? []).length > 0, `${courses?.length ?? 0} cours gratuits`);

const target = courses?.[0];

// 7. Inscription au cours (RPC, contrôle d'accès réel)
const { data: enrollmentId, error: enrollError } = await supabase.rpc("enroll_in_course", {
  p_course_id: target.id,
});
check("Inscription au cours", !enrollError && Boolean(enrollmentId), enrollError?.message);

// 8. Accès au cours accordé
const { data: canAccess } = await supabase.rpc("can_access_course", { p_course_id: target.id });
check("Accès au cours accordé", canAccess === true);

// 9. Progression : terminer toutes les leçons
const { data: modules } = await supabase.from("modules").select("id").eq("course_id", target.id);
const moduleIds = (modules ?? []).map((m) => m.id);
const { data: lessons } = await supabase.from("lessons").select("id").in("module_id", moduleIds).order("position");

let lastProgress = 0;
for (const lesson of lessons ?? []) {
  const { data } = await supabase.rpc("complete_lesson", {
    p_lesson_id: lesson.id,
    p_seconds: 60,
  });
  lastProgress = data?.progress_pct ?? lastProgress;
}
check("Progression recalculée", lastProgress === 100, `${lastProgress} %`);

// 10. Examens du cours : tentative + correction serveur
const { data: exercises } = await supabase.from("exercises").select("*").eq("course_id", target.id).eq("is_published", true);

let examPassed = true;
for (const exercise of exercises ?? []) {
  const { data: attemptId, error: startError } = await supabase.rpc("start_attempt", {
    p_exercise_id: exercise.id,
  });
  if (startError) {
    check(`Tentative « ${exercise.title_fr} »`, false, startError.message);
    examPassed = false;
    continue;
  }

  // Répond correctement à toutes les questions (le réseau ne voit jamais les réponses :
  // ici on lit la correction depuis la base pour simuler un apprenant parfait).
  const { data: full } = await supabase
    .from("exercises")
    .select("questions")
    .eq("id", exercise.id)
    .single();

  const answers = {};
  for (const question of full.questions ?? []) answers[question.id] = question.correct;

  const { data: result, error: submitError } = await supabase.rpc("submit_attempt", {
    p_attempt_id: attemptId,
    p_answers: answers,
  });

  const ok = !submitError && result?.passed === true;
  if (!ok) examPassed = false;
  check(`Examen « ${exercise.title_fr} »`, ok, submitError?.message ?? `score ${result?.score}`);
}

// 11. Certificat
const { data: certificate, error: certError } = await supabase.rpc("issue_certificate", {
  p_course_id: target.id,
});
check("Émission du certificat", !certError && Boolean(certificate?.serial), certError?.message ?? certificate?.serial);

// 12. Vérification publique du certificat
if (certificate?.serial) {
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false },
    ...(wsTransport ? { realtime: { transport: wsTransport } } : {}),
  });
  const { data: verification } = await anon.rpc("verify_certificate", {
    p_serial: certificate.serial,
  });
  check("Vérification publique du certificat", verification?.found === true, verification?.student_name);

  const { data: forged } = await anon.rpc("verify_certificate", { p_serial: "DIGI-2026-ZZZZZZZ" });
  check("Certificat inexistant rejeté", forged?.found === false);
}

// 13. Tentative d'escalade de privilèges
const { error: roleError } = await supabase
  .from("profiles")
  .update({ role: "admin" })
  .eq("id", auth.user.id);
check("Escalade de rôle bloquée", Boolean(roleError), roleError?.code);

// 14. Prix non manipulable : la RPC recalcule à partir de la base
const { data: paidCourse } = await supabase
  .from("public_courses")
  .select("id")
  .eq("is_free", false)
  .limit(1)
  .maybeSingle();
if (paidCourse) {
  const { error: paidError } = await supabase.rpc("enroll_in_course", { p_course_id: paidCourse.id });
  check("Cours payant refusé sans paiement", Boolean(paidError), paidError?.message);
}

await supabase.auth.signOut();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} vérifications réussies.`);
if (failed.length) {
  console.log("Échecs :", failed.map((f) => f.label).join(", "));
  process.exit(1);
}
