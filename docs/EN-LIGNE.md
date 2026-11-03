# DIGINIGER est en ligne

**Adresse du site : https://diginiger.vercel.app**

Mise en ligne le 3 novembre 2026. Déploiement `dpl_GNWL7Kns789k3K8bSYbdqB71t1SP`, état **READY**, promu en production.

---

## Ce qui a été fait

| Étape | Résultat |
| --- | --- |
| Dépôt GitHub | `github.com/IGZIG/DIGINIGER` — 255 fichiers, branche `main` |
| Archive zip déposée par erreur | supprimée du dépôt |
| Projet Vercel | `diginiger` (équipe IGZIG), connecté au dépôt |
| Cible Node.js | fixée à 22 (le projet était en 26, incompatible avec Next 15) |
| Variables d'environnement | 4 créées en Production + Aperçu |
| Build | réussi en 92 secondes |
| Alias public | `diginiger.vercel.app` |

### Les 4 variables posées

| Nom | Rôle |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | adresse de la base |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé publique (lecture du site) |
| `SUPABASE_SERVICE_ROLE_KEY` | clé privée (stockée en « sensitive ») |
| `NEXT_PUBLIC_SITE_URL` | `https://diginiger.vercel.app` |

---

## Contrôles effectués sur le site en ligne

| Adresse | Résultat |
| --- | --- |
| `/` (accueil) | 200 — titre « DIGINIGER — Apprendre aujourd'hui. Construire le monde de demain. » |
| `/formations` | 200 — les vraies données de la base s'affichent (FCFA, Gratuit, Marketing, Comptabilité) |
| `/connexion` | 200 |
| `/inscription` | 200 |
| `/ecoles`, `/a-propos`, `/contact`, `/tarifs` | 200 |
| `/app`, `/admin`, `/formateur` sans être connecté | redirigent vers `/connexion` (protection active) |
| Version anglaise | `<html lang="en">`, boutons « Courses », « Sign in » |
| `/api/payments/webhook` en POST | **503 `PAYMENT_NOT_CONFIGURED`** — refus explicite, aucune fausse réussite |
| `/api/ai/chat` | 401 `AUTH_REQUIRED` (il faut être connecté) |
| `/api/ai/diagnostic` sans session | 401 |

Le comportement est celui attendu : **le site fonctionne, et il refuse honnêtement** ce qui n'est pas encore configuré (clés OpenAI et PayDunya absentes).

---

## Ce qui reste à faire

1. **Révoquer le jeton GitHub** utilisé pour l'envoi : [github.com/settings/tokens](https://github.com/settings/tokens) → `Delete`.
2. **Clé OpenAI** : sans elle, le tuteur IA répond `503 AI_NOT_CONFIGURED` (c'est voulu).
3. **Clés PayDunya** : sans elles, les paiements répondent `503 PAYMENT_NOT_CONFIGURED` (c'est voulu).
4. **Protection des adresses de préversion** : `diginiger-igzig.vercel.app` et `diginiger-git-main-igzig.vercel.app` demandent une connexion Vercel. Seule `diginiger.vercel.app` est publique — c'est l'adresse à communiquer. Pour ouvrir les préversions : Vercel → Settings → Deployment Protection → désactiver.
5. **Adresse IPN à déclarer chez PayDunya** : `https://diginiger.vercel.app/api/payments/webhook?provider=mobile_money`
6. **Nom de domaine** (facultatif) : achat d'un domaine type `diginiger.ne`, puis Vercel → Settings → Domains.

---

## Bon à savoir

- Chaque `git push` sur `main` déclenche automatiquement un nouveau déploiement.
- La région est `iad1` (Washington) alors que la base est en `eu-west-1` (Irlande) : compter ~90 ms de latence supplémentaire par requête base. Passer en `cdg1` (Paris) est possible et gratuit.
- Le plan gratuit de Vercel limite à 100 Go de trafic par mois ; le site pèse ~250 Ko par page d'accueil.
