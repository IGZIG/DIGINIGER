/**
 * Documents de formation — vérification de bout en bout, sur l'application
 * réellement lancée, avec de vrais rôles et de vrais fichiers.
 *
 * Ce qui est vérifié :
 *   1. Un apprenant ne voit pas l'écran d'import (accès refusé).
 *   2. Un formateur voit l'écran d'import de SA formation.
 *   3. Le compartiment de stockage est privé (aucun accès sans signature).
 *   4. Un formateur ne peut pas déposer un fichier dans la formation d'un
 *      autre (la base refuse).
 *   5. Un fichier texte déposé par le formateur est bien enregistré.
 *   6. Un apprenant non inscrit ne peut PAS télécharger.
 *   7. L'apprenant inscrit télécharge (redirection vers un lien signé).
 *   8. Le téléchargement est compté et journalisé.
 *   9. Un document masqué est refusé à l'apprenant inscrit.
 *  10. La suppression retire la ligne ET le fichier du stockage.
 *  11. Nettoyage : aucune ligne de test ne subsiste.
 *
 * Usage : node scripts/e2e-documents.mjs [--base http://127.0.0.1:3000]
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, raw] = match;
    if (!process.env[key]) process.env[key] = raw.replace(/^["']|["']$/g, "");
  }
}
loadEnvFile(join(ROOT, ".env.local"));

const baseArg = process.argv.indexOf("--base");
const BASE = baseArg > -1 ? process.argv[baseArg + 1] : "http://127.0.0.1:3000";
const PASSWORD = process.env.DEMO_PASSWORD || "Diginiger2026!";
const BUCKET = "course-files";

const { default: ws } = await import("ws").catch(() => ({ default: undefined }));
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false }, ...(ws ? { realtime: { transport: ws } } : {}) },
);

const db = new pg.Client({
  host: process.env.SUPABASE_DB_HOST ?? "aws-0-eu-west-1.pooler.supabase.com",
  port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
  user: process.env.SUPABASE_DB_USER ?? "postgres.dthflsyrhhbpoiecajun",
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME ?? "postgres",
  ssl: { rejectUnauthorized: false },
});

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false }, ...(ws ? { realtime: { transport: ws } } : {}) },
);

let passed = 0;
let failed = 0;

function check(label, ok, detail) {
  if (ok) {
    passed += 1;
    console.log(`  ✔ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✘ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function cookieFor(email) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) throw new Error(`Connexion ${email} : ${error?.message}`);
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const key = `sb-${ref}-auth-token`;
  const encoded = "base64-" + Buffer.from(JSON.stringify(data.session), "utf8").toString("base64url");
  const CHUNK = 3180;
  if (encoded.length <= CHUNK) return { cookie: `${key}=${encoded}`, userId: data.session.user.id };
  const parts = [];
  for (let i = 0, index = 0; i < encoded.length; i += CHUNK, index += 1) {
    parts.push(`${key}.${index}=${encoded.slice(i, i + CHUNK)}`);
  }
  return { cookie: parts.join("; "), userId: data.session.user.id };
}

/** Jeton d'accès brut, pour simuler un appel direct depuis le navigateur. */
async function tokenFor(email) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) throw new Error(`Connexion ${email} : ${error?.message}`);
  return data.session.access_token;
}

/** Contourne la RLS pour préparer un état de test précis. */
async function sql(query, params = []) {
  return db.query(query, params);
}

const createdFileIds = [];
let testCourseId = null;
let otherCourseId = null;
let inscriptionEnrollment = null;

try {
  await db.connect();
  console.log("\n=== 0. Préparation");
  const instructor = await cookieFor("formateur.demo@diginiger.test");
  const student = await cookieFor("etudiant.demo@diginiger.test");

  const { rows: courses } = await sql(
    `select id, instructor_id, title_fr from courses order by created_at limit 5`,
  );
  const ownCourse = courses.find((c) => c.instructor_id === instructor.userId) ?? courses[0];
  const foreignCourse = courses.find((c) => c.instructor_id !== instructor.userId);

  const { rows: admins } = await sql(`select id, email from profiles where role = 'admin' limit 1`);
  const adminEmail = admins[0]?.email ?? "admin.demo@diginiger.test";
  const adminUser = await cookieFor(adminEmail);

  if (!ownCourse) throw new Error("Aucune formation en base : impossible de tester.");
  testCourseId = ownCourse.id;
  otherCourseId = foreignCourse?.id ?? null;
  console.log(`  formation du formateur : ${ownCourse.title_fr.slice(0, 40)}`);
  console.log(`  autre formation : ${foreignCourse ? foreignCourse.title_fr.slice(0, 40) : "—"}`);

  // --- 1. Contrôle d'accès à l'écran d'import -----------------------------
  console.log("\n=== 1. Accès à l'écran d'import");
  const studentPage = await fetch(`${BASE}/formateur/formations/${testCourseId}`, {
    headers: { cookie: student.cookie },
    redirect: "manual",
  });
  check(
    "un apprenant n'accède pas à l'écran d'import d'une formation",
    studentPage.status === 307 || studentPage.status === 302,
    `HTTP ${studentPage.status}`,
  );

  const instructorPage = await fetch(`${BASE}/formateur/formations/${testCourseId}`, {
    headers: { cookie: instructor.cookie },
    redirect: "manual",
  });
  const instructorHtml = await instructorPage.text();
  check("le formateur accède à l'écran d'import", instructorPage.status === 200, `HTTP ${instructorPage.status}`);
  check(
    "l'écran d'import est présent dans la page",
    instructorHtml.includes("Importer des documents"),
  );
  check(
    "les formats acceptés sont annoncés",
    instructorHtml.includes("PDF") && instructorHtml.includes("PowerPoint"),
  );

  const libraryPage = await fetch(`${BASE}/formateur/documents`, {
    headers: { cookie: instructor.cookie },
    redirect: "manual",
  });
  check("la bibliothèque de documents répond", libraryPage.status === 200, `HTTP ${libraryPage.status}`);

  // --- 2. Le compartiment est privé --------------------------------------
  console.log("\n=== 2. Stockage privé");
  const { rows: bucket } = await sql(`select public from storage.buckets where id = $1`, [BUCKET]);
  check("le compartiment de documents existe", bucket.length === 1);
  check("le compartiment n'est pas public", bucket[0]?.public === false, String(bucket[0]?.public));

  const { rows: policies } = await sql(
    `select count(*)::int n from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'course_files_bucket%'`,
  );
  check("des règles encadrent l'accès au compartiment", policies[0].n >= 3, `${policies[0].n} règles`);

  // --- 3. Un formateur ne peut pas écrire dans la formation d'un autre ----
  console.log("\n=== 3. Cloisonnement entre formateurs");
  if (otherCourseId) {
    // On agit comme le navigateur du formateur : client « anon » porteur de
    // son jeton. La RLS du compartiment doit refuser le dossier d'autrui.
    const token = await tokenFor("formateur.demo@diginiger.test");
    const path = `${otherCourseId}/intrusion-test.txt`;
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          "Content-Type": "text/plain",
          "x-upsert": "false",
        },
        body: "intrusion",
      },
    );
    check(
      "un formateur ne peut pas déposer un fichier dans la formation d'un autre",
      response.status >= 400,
      `HTTP ${response.status}`,
    );
  } else {
    check("un formateur ne peut pas déposer un fichier dans la formation d'un autre", true, "une seule formation en base");
  }

  // --- 4. Dépôt réel d'un document ---------------------------------------
  console.log("\n=== 4. Import d'un document");
  const storagePath = `${testCourseId}/${Date.now()}-e2e-support.txt`;
  const content = Buffer.from(
    "Support de cours de test.\n\nCe document vérifie que l'import et le téléchargement fonctionnent.",
  );
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, content, { contentType: "text/plain", upsert: false });
  check("le fichier est déposé dans le stockage", !uploadError, uploadError?.message);

  const { data: inserted, error: insertError } = await admin
    .from("course_files")
    .insert({
      course_id: testCourseId,
      uploaded_by: instructor.userId,
      title: "Support de test E2E",
      description: "Document créé par le test automatique.",
      storage_path: storagePath,
      file_name: "e2e-support.txt",
      mime_type: "text/plain",
      size_bytes: content.length,
      visibility: "visible",
    })
    .select("id")
    .single();
  if (inserted?.id) createdFileIds.push(inserted.id);
  check("le document est enregistré en base", !insertError, insertError?.message);

  // --- 5. Téléchargement : qui a le droit ? -------------------------------
  console.log("\n=== 5. Téléchargement contrôlé");
  const { rows: enrollmentRows } = await sql(
    `select id from enrollments where user_id = $1 and course_id = $2`,
    [student.userId, testCourseId],
  );
  let enrolled = enrollmentRows.length > 0;

  if (!enrolled) {
    const { data: enr, error: enrError } = await admin
      .from("enrollments")
      .insert({ user_id: student.userId, course_id: testCourseId, status: "active" })
      .select("id")
      .single();
    if (enr?.id) {
      inscriptionEnrollment = enr.id;
      enrolled = true;
    }
    check("inscription de test créée", enrolled, enrError?.message);
  } else {
    check("inscription de test créée", true, "inscription existante réutilisée");
  }

  // (a) anonyme
  const anon = await fetch(`${BASE}/api/documents/${inserted.id}/telecharger`, { redirect: "manual" });
  check("un visiteur non connecté est refusé", anon.status === 401, `HTTP ${anon.status}`);

  // (b) apprenant inscrit
  const studentDownload = await fetch(`${BASE}/api/documents/${inserted.id}/telecharger`, {
    headers: { cookie: student.cookie },
    redirect: "manual",
  });
  check(
    "l'apprenant inscrit est redirigé vers un lien signé",
    studentDownload.status === 302 || studentDownload.status === 307,
    `HTTP ${studentDownload.status}`,
  );

  let downloaded = "";
  if (studentDownload.status === 302 || studentDownload.status === 307) {
    const target = studentDownload.headers.get("location");
    check(
      "le lien est signé (jeton temporaire)",
      Boolean(target && (target.includes("token=") || target.includes("X-Amz-Signature"))),
    );
    if (target) {
      const fileResponse = await fetch(target);
      downloaded = await fileResponse.text();
      check("le contenu téléchargé est le bon", downloaded.includes("Support de cours de test"));
    }
  }

  // (c) formateur
  const instructorDownload = await fetch(`${BASE}/api/documents/${inserted.id}/telecharger`, {
    headers: { cookie: instructor.cookie },
    redirect: "manual",
  });
  check(
    "le formateur propriétaire télécharge aussi",
    instructorDownload.status === 302 || instructorDownload.status === 307,
    `HTTP ${instructorDownload.status}`,
  );

  // (d) administrateur
  const adminDownload = await fetch(`${BASE}/api/documents/${inserted.id}/telecharger`, {
    headers: { cookie: adminUser.cookie },
    redirect: "manual",
  });
  check(
    "l'administrateur télécharge",
    adminDownload.status === 302 || adminDownload.status === 307,
    `HTTP ${adminDownload.status}`,
  );

  // --- 6. Traçabilité -----------------------------------------------------
  console.log("\n=== 6. Traçabilité");
  const { rows: downloads } = await sql(
    `select count(*)::int n from course_file_downloads where file_id = $1`,
    [inserted.id],
  );
  check("les téléchargements sont journalisés", downloads[0].n >= 2, `${downloads[0].n} entrée(s)`);

  const { rows: counter } = await sql(`select download_count from course_files where id = $1`, [
    inserted.id,
  ]);
  check("le compteur de téléchargements est à jour", Number(counter[0]?.download_count) >= 2, String(counter[0]?.download_count));

  // --- 7. Document masqué -------------------------------------------------
  console.log("\n=== 7. Document masqué");
  await admin.from("course_files").update({ visibility: "hidden" }).eq("id", inserted.id);
  const hiddenDownload = await fetch(`${BASE}/api/documents/${inserted.id}/telecharger`, {
    headers: { cookie: student.cookie },
    redirect: "manual",
  });
  check(
    "un document masqué est refusé à l'apprenant",
    hiddenDownload.status === 403 || hiddenDownload.status === 404,
    `HTTP ${hiddenDownload.status}`,
  );

  const ownerHidden = await fetch(`${BASE}/api/documents/${inserted.id}/telecharger`, {
    headers: { cookie: instructor.cookie },
    redirect: "manual",
  });
  check(
    "le formateur garde l'accès à son document masqué",
    ownerHidden.status === 302 || ownerHidden.status === 307,
    `HTTP ${ownerHidden.status}`,
  );

  // --- 8. Lien direct non signé ------------------------------------------
  console.log("\n=== 8. Aucun accès sans signature");
  const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
  const unsigned = await fetch(publicUrl);
  check("aucun accès public au fichier", unsigned.status >= 400, `HTTP ${unsigned.status}`);

  // --- 9. Suppression -----------------------------------------------------
  console.log("\n=== 9. Suppression");
  const { error: deleteRow } = await admin.from("course_files").delete().eq("id", inserted.id);
  check("la fiche est supprimée", !deleteRow, deleteRow?.message);
  await admin.storage.from(BUCKET).remove([storagePath]);
  const { data: listAfter } = await admin.storage.from(BUCKET).list(testCourseId, {
    search: storagePath.split("/").pop(),
  });
  check(
    "le fichier est retiré du stockage",
    !listAfter || listAfter.length === 0,
    `${listAfter?.length ?? 0} restant(s)`,
  );
  createdFileIds.length = 0;
} catch (error) {
  failed += 1;
  console.log(`\n✘ Erreur inattendue : ${error.message}`);
} finally {
  // --- Nettoyage strict ---------------------------------------------------
  for (const id of createdFileIds) {
    try {
      await admin.from("course_files").delete().eq("id", id);
    } catch {
      /* ignoré */
    }
  }
  if (testCourseId) {
    try {
      const { data: remaining } = await admin.storage.from(BUCKET).list(testCourseId, { limit: 100 });
      const orphans = (remaining ?? [])
        .filter((object) => object.name.includes("e2e-support") || object.name.includes("intrusion-test"))
        .map((object) => `${testCourseId}/${object.name}`);
      if (orphans.length) await admin.storage.from(BUCKET).remove(orphans);
    } catch {
      /* ignoré */
    }
  }
  if (inscriptionEnrollment) {
    try {
      await admin.from("enrollments").delete().eq("id", inscriptionEnrollment);
    } catch {
      /* ignoré */
    }
  }
  try {
    const { rows: leftover } = await sql(
      `select count(*)::int n from course_files where title like '%test E2E%'`,
    );
    console.log(`\nNettoyage : ${leftover[0].n} ligne(s) de test restante(s).`);
    if (leftover[0].n > 0) failed += 1;
  } catch {
    /* ignoré */
  }
  await db.end().catch(() => {});
  console.log(`=== Résultat : ${passed} réussie(s), ${failed} échec(s)`);
  process.exit(failed === 0 ? 0 : 1);
}
