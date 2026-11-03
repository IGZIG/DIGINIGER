# DIGINIGER — état du produit et guide de passation

> Dernière vérification automatisée : `npm run build` vert, `npm run check` = **100 vérifications
> réussies (15 base + 58 interface + 9 actions serveur + 18 paiement), 0 échec**.

Ce document décrit ce qui **fonctionne réellement**, ce qui dépend d'une configuration externe,
et comment reprendre le projet. Aucune fonctionnalité décrite ici n'est une maquette.

---

## 1. Ce qui est livré

### Trois interfaces de rôle, réellement cloisonnées

| Espace | Route racine | Contrôle d'accès |
| --- | --- | --- |
| Apprenant | `/app` | session + rôle `student` (ou `admin`) |
| Formateur | `/formateur` | session + rôle `instructor` ou `admin` |
| Administration | `/admin` | session + rôle `admin` **uniquement** |

Le cloisonnement est vérifié à trois niveaux :

1. **Middleware** (bord) : redirection `307` vers `/connexion` ou `/app?erreur=acces-refuse` avant
   tout début de rendu — un apprenant qui ouvre `/admin` reçoit un vrai 307, pas une page vide.
2. **Layout serveur** : `requireRole()` relit le profil en base (jamais un cookie, jamais un paramètre).
3. **PostgreSQL / RLS** : même en appelant l'API REST directement avec un jeton d'apprenant, les
   données et les écritures d'administration sont refusées.

### Espace apprenant

Tableau de bord (progression, reprise de cours, notifications), mes formations, lecteur de leçon,
progression, exercices et examens (chrono, tentatives limitées, correction automatique), certificats
(PDF + QR + vérification publique), tuteur IA, abonnement, profil.

### Espace formateur (nouveau)

- Tableau de bord : formations, apprenants, revenus, brouillons.
- **Éditeur de formation** (`/formateur/formations/[id]`) : informations générales, programme
  (modules → leçons), évaluations (création JSON validée), **soumission à validation**.
  Un formateur ne publie jamais lui-même : la formation passe en `in_review`.
- **Générateur** (`/formateur/generateur`) : rédaction manuelle ou brouillon IA relu avant
  matérialisation (onglets), validation Zod stricte de la sortie du modèle.
- Évaluations : suivi des QCM et des copies en attente.
- Apprenants : inscriptions et progression par formation (données réelles, filtre par formateur).
- Revenus : transactions réellement confirmées, part formateur de 70 %, montant nul s'il n'y a
  aucune vente (aucune estimation).

### Espace administrateur (nouveau)

- Tableau de bord : indicateurs agrégés (fonction SQL `admin_dashboard_stats`), courbes revenus /
  inscriptions par école (Recharts), journal d'audit récent.
- **Formations** : validation éditoriale (publier / renvoyer en brouillon / archiver) avec refus
  explicite si la formation ne contient aucune leçon, publication groupée des évaluations.
- **Utilisateurs** : recherche, filtre par rôle, changement de rôle journalisé, **impossible de
  modifier son propre rôle** (anti-verrouillage).
- **Demandes** : contacts, candidatures formateurs, demandes entreprises ; statuts.
- **Paiements** : transactions, état réel du fournisseur (configuré / non configuré), codes promo,
  remboursements (RPC `process_refund`).
- **Contenus IA** : relecture des générations, acceptation / rejet.
- **Certificats** : liste, vérification, **révocation motivée** (immédiate sur la page publique).
- **Paramètres** : vue de contrôle en lecture seule (aucune clé affichée, seulement leur présence),
  contrôle de santé réel de la base.

### Site public

Accueil, catalogue avec filtres (école, niveau, prix, tri, recherche), six fiches d'école,
fiche formation complète, tarifs, à propos, formateurs, entreprises, contact, vérification de
certificat, tuteur IA public, pages légales, inscription / connexion / mot de passe oublié, tunnel
de paiement.

### Bilinguisme FR / EN

Bascule réelle dans l'en-tête (`FR | EN`) : la langue est stockée dans le cookie
`diginiger_locale`, rendue côté serveur (`<html lang>`, navigation, accueil, fiches écoles avec les
colonnes `*_en`). Français par défaut.

---

## 2. Ce qui dépend d'une configuration externe (et se comporte honnêtement)

| Fonction | Sans configuration | Pour activer |
| --- | --- | --- |
| Tuteur IA (`/api/ai/chat`) | **503** `AI_NOT_CONFIGURED`, aucune réponse inventée | `OPENAI_API_KEY` (voir `docs/INTEGRATIONS-IA-ET-PAIEMENT.md`) |
| Générateur de formations (`/api/ai/generate-course`) | **503**, aucun brouillon fabriqué | idem |
| Paiement Mobile Money / carte | **503**, aucun faux succès ; l'accès reste fermé | `PAYDUNYA_*` ou `CINETPAY_*` (voir guide) |
| Emails transactionnels | non câblés (affiché tel quel dans `/admin/parametres`) | fournisseur SMTP |

Règle appliquée partout : **mieux vaut une erreur visible qu'une donnée inventée**. Les graphiques
sans données affichent un message, pas une courbe fictive ; les revenus sans vente affichent 0 FCFA.

---

## 3. Comptes de démonstration

Mot de passe commun : `Diginiger2026!` — domaine `@diginiger.test`.

| Compte | Rôle |
| --- | --- |
| `admin.demo@diginiger.test` | administrateur |
| `aissatou.demo@`, `moussa.demo@`, `fatou.demo@`, `ibrahim.demo@`, `ramatou.demo@`, `souleymane.demo@` | formateurs |
| `etudiant.demo@`, `etudiant2.demo@` | apprenants |

Contenu de démonstration : 6 écoles, 4 offres, 13 formations, 39 modules, 117 leçons,
6 évaluations (dont 2 examens), 2 documents pédagogiques pour le RAG, 2 codes promo.

---

## 4. Vérifier soi-même

```bash
npm install
npm run typecheck          # TypeScript strict
npm run build              # build de production
npm run start              # http://localhost:3000

# dans un autre terminal
npm run check              # 15 (base) + 58 (interface) + 9 (actions serveur)
```

Détail :

- `npm run check:db` — RLS, inscription, progression, examen, certificat, refus d'escalade de rôle.
- `npm run check:ui` — 15 pages publiques, 6 fiches écoles + fiches formations, 9 pages apprenant,
  6 pages formateur, 8 pages admin, cloisonnement des rôles, bilinguisme, **chasse aux liens morts**
  sur tous les liens internes du HTML.
- `npm run payments:sandbox` — 18 contrôles du circuit de paiement (PayDunya + CinetPay simulés,
  falsification de notification incluse), lecture de l'état réel en base.
- `npm run check:actions` — Server Actions réelles via le protocole Next : refus pour un non-admin,
  publication effective, publication bloquée sans leçon, changement de rôle effectif,
  auto-rétrogradation refusée, révocation de certificat effective (avec relecture en base).

Les scripts chargent automatiquement `.env.local`. Pour tester une session manuellement :
`node scripts/session-cookie.mjs admin.demo@diginiger.test` renvoie l'en-tête `Cookie` à passer à curl.

---

## 5. Base de données

- Projet Supabase dédié, PostgreSQL 17 — **26 tables, 12 migrations** appliquées.
- Migrations versionnées dans `supabase/migrations/` (`npm run migrate`).
- Données de démonstration : `npm run seed` (idempotent, rejouable).
- Points de sécurité importants, déjà corrigés et couverts par les tests :
  - `is_trusted_context()` s'appuie sur `session_user` + `auth.role()` (et non `current_user`, qui
    vaut le propriétaire dans une fonction `SECURITY DEFINER`) : sans ce correctif, un apprenant
    pouvait devenir administrateur.
  - `pgcrypto` réside dans le schéma `extensions` (`extensions.digest`).
  - `admin_dashboard_stats`, `process_refund`, `issue_certificate` : `service_role` uniquement,
    appelées depuis le serveur après vérification du rôle.

---

## 6. Architecture (repères)

```
src/
  app/
    (public)/        site vitrine + fiches + tunnel de paiement
    (student)/app/   espace apprenant
    (instructor)/formateur/  espace formateur (dashboard, éditeur, générateur)
    (admin)/admin/   espace administration (8 pages)
    api/             ai/{chat,status,generate-course}, payments/{checkout,webhook},
                     certificates/[serial]/pdf, auth/*
  components/
    dashboard/       sidebar, stat-card, charts, ai-chat, course-builder, course-editor,
                     admin-actions, refund-actions, generation-review
    marketing/       header (avec sélecteur FR/EN), footer, cartes, illustrations
    ui/              button, fields, primitives, badge
    forms/           auth, contact, checkout, profile, promo, vérificateur de certificat
  lib/
    actions/         learning, account, instructor, admin  (Server Actions)
    ai/tutor.ts      RAG : embeddings, récupération, prompts, indexation
    payments/        abstraction fournisseur + vérification de signature
    i18n/            dictionnaires FR/EN + lecture serveur
    supabase/        server, client, admin (service_role), middleware
  middleware.ts      rafraîchissement de session + garde de rôle anticipée
```

---

## 7. Reste à faire (par ordre d'impact)

1. **Clés OpenAI** : tout est branché et testé ; il reste à coller `OPENAI_API_KEY` puis
   `npm run ai:check && npm run ai:index` (voir `docs/INTEGRATIONS-IA-ET-PAIEMENT.md`).
2. **Agrégateur Mobile Money** : adaptateurs PayDunya et CinetPay terminés et validés en bac à sable ;
   il reste à coller les clés marchand, déclarer l'URL de notification et faire un paiement test réel.
3. **Emails transactionnels** : confirmation d'inscription, reçus, relances.
4. **Tests navigateur** (Playwright) pour les parcours visuels : clic, formulaires, upload, PDF.
5. **Internationalisation étendue** : les pages intérieures (catalogue, tarifs, légal) restent en
   français ; le socle (`lib/i18n`) est prêt, il reste à extraire les libellés.
6. **Observabilité** : centraliser les erreurs serveur (Sentry ou équivalent) avant mise en production.
