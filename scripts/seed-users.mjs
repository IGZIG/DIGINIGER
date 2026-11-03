/**
 * Création des comptes de DÉMONSTRATION via l'API Admin Supabase.
 * Idempotent : un compte existant est réutilisé, son mot de passe remis à zéro.
 *
 * Usage :
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-users.mjs
 *
 * Ces comptes servent aux tests automatisés et aux captures. En production,
 * supprimez ce script du pipeline ou protégez-le par un secret.
 */
import { createClient } from "@supabase/supabase-js";

// Node < 22 : fournir une implémentation WebSocket au client Realtime.
let wsTransport;
try {
  const wsModule = await import("ws");
  wsTransport = wsModule.default ?? wsModule;
} catch {
  wsTransport = undefined;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  ...(wsTransport ? { realtime: { transport: wsTransport } } : {}),
});

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Diginiger2026!";

const USERS = [
  { email: "admin.demo@diginiger.test", fullName: "Aïcha Maïga", role: "admin" },
  { email: "aissatou.demo@diginiger.test", fullName: "Aïssatou Diallo", role: "instructor" },
  { email: "moussa.demo@diginiger.test", fullName: "Moussa Abdou", role: "instructor" },
  { email: "fatou.demo@diginiger.test", fullName: "Fatou Coulibaly", role: "instructor" },
  { email: "ibrahim.demo@diginiger.test", fullName: "Ibrahim Souley", role: "instructor" },
  { email: "ramatou.demo@diginiger.test", fullName: "Ramatou Issa", role: "instructor" },
  { email: "souleymane.demo@diginiger.test", fullName: "Souleymane Bello", role: "instructor" },
  { email: "etudiant.demo@diginiger.test", fullName: "Nadia Oumarou", role: "student" },
  { email: "etudiant2.demo@diginiger.test", fullName: "Karim Yahaya", role: "student" },
];

console.log("Création des comptes de démonstration…\n");
const results = [];

for (const user of USERS) {
  // 1. Créer ou mettre à jour le compte Auth
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: user.email,
    password: DEMO_PASSWORD,
    email_confirm: true, // comptes de démonstration : email déjà vérifié
    user_metadata: { full_name: user.fullName, locale: "fr" },
  });

  let userId = created?.user?.id;

  if (createError) {
    if (!/already|exists|registered/i.test(createError.message)) {
      console.error(`✗ ${user.email} — ${createError.message}`);
      continue;
    }

    // Compte existant : retrouver l'identifiant et réinitialiser le mot de passe
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existing = list?.users?.find((candidate) => candidate.email === user.email);
    if (!existing) {
      console.error(`✗ ${user.email} — introuvable malgré l'erreur de doublon`);
      continue;
    }
    userId = existing.id;
    await admin.auth.admin.updateUserById(userId, { password: DEMO_PASSWORD });
  }

  if (!userId) {
    console.error(`✗ ${user.email} — identifiant indisponible`);
    continue;
  }

  // 2. Le trigger handle_new_user crée le profil ; on aligne le rôle et le nom.
  const { error: profileError } = await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        email: user.email,
        full_name: user.fullName,
        role: user.role,
        is_verified: true,
        country: "NE",
        city: "Niamey",
        locale: "fr",
      },
      { onConflict: "id" },
    );

  if (profileError) {
    console.error(`✗ profil ${user.email} — ${profileError.message}`);
    continue;
  }

  results.push({ ...user, id: userId });
  console.log(`✓ ${user.role.padEnd(10)} ${user.email}`);
}

console.log(`\n${results.length}/${USERS.length} comptes prêts.`);
console.log(`Mot de passe commun : ${DEMO_PASSWORD}`);
