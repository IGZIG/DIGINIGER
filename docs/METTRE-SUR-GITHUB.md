# Envoyer DIGINIGER sur GitHub, puis sur Vercel

Ce guide ne demande aucune connaissance technique. Comptez 10 minutes.

---

## Ce qui est déjà fait

- Le projet est prêt sur l'ordinateur qui m'héberge, avec **un historique Git complet** (branche `main`, 165 fichiers, 1 commit).
- Un script a été écrit et testé : `scripts/push-to-github.sh`.
- J'ai vérifié qu'**aucune clé secrète ne partira sur GitHub** : ni mot de passe de base de données, ni clé Supabase, ni clé OpenAI. Le fichier `.env.local` (vos clés) est exclu automatiquement.

Il ne manque qu'une chose : **votre autorisation GitHub**. Je ne peux pas la prendre à votre place — je n'ai pas de compte GitHub branché sur cette conversation.

---

## Méthode A — la plus simple (5 minutes, sans ligne de commande)

1. Ouvrez **[github.com/new](https://github.com/new)**.
2. **Repository name** : `diginiger`
3. Cochez **Private**.
4. Cliquez le bouton vert **Create repository**.
5. Sur la page qui s'affiche, cliquez **uploading an existing file**.
6. Dans le dossier `diginiger` de l'espace de travail, **sélectionnez tous les fichiers et dossiers** (sauf `node_modules`, `.next` et `.env.local`), puis glissez-les dans la page.
7. En bas, cliquez **Commit changes**.

> ⚠️ Ne déposez **jamais** le fichier `.env.local` : il contient vos clés.

---

## Méthode B — automatique (si vous préférez me laisser faire)

1. Ouvrez **[github.com/settings/tokens](https://github.com/settings/tokens)**.
2. Cliquez **Generate new token (classic)**.
3. Nom : `diginiger`, durée : `30 days`, cochez uniquement la case **`repo`**.
4. Cliquez **Generate token** et copiez la ligne qui commence par `ghp_`.
5. Collez-la ici en me disant « voici mon jeton : ghp_... ».

Je lance alors le script, le dépôt apparaît sous votre compte, et je peux enchaîner **tout seul** sur le déploiement Vercel.

> Un jeton est un mot de passe temporaire. Révoquez-le après (`Delete` sur la même page) et tout reste en place.

---

## Ensuite : le déploiement Vercel

Le projet Vercel `diginiger` existe déjà. Il ne lui manque que le code.

1. Vercel → projet **diginiger** → onglet **Settings** → **Git**.
2. **Connect Git Repository** → choisissez `diginiger`.
3. Retour sur l'onglet **Deployments** → **Redeploy**.

### Les 4 réglages à saisir avant de redéployer

Vercel → projet **diginiger** → **Settings** → **Environment Variables** → environnement **Production** :

| Nom | Valeur |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://dthflsyrhhbpoiecajun.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | votre clé « anon » (dans `.env.local`) |
| `SUPABASE_SERVICE_ROLE_KEY` | votre clé « service_role » (dans `.env.local`) |
| `NEXT_PUBLIC_SITE_URL` | l'adresse donnée par Vercel, ex. `https://diginiger.vercel.app` |

À **ne pas** recopier sur Vercel : les lignes `SUPABASE_DB_*` (elles ne servent qu'aux scripts locaux).

---

## Après la mise en ligne — ce que je ferai pour vous

1. Ouvrir le site et vérifier que l'accueil, les formations et la connexion fonctionnent.
2. Corriger `NEXT_PUBLIC_SITE_URL` avec l'adresse réelle.
3. Vous donner l'adresse exacte à coller dans PayDunya (la « notification » de paiement).

---

## En cas de problème

| Message | Cause | Solution |
| --- | --- | --- |
| `Bad credentials` | jeton mal copié | recopier depuis `github.com/settings/tokens` |
| Vercel montre un écran blanc | variables manquantes | revérifier les 4 lignes du tableau |
| Vercel affiche « Authentication required » | protection du plan gratuit | Settings → Deployment Protection → désactiver |
| Les formations ne s'affichent pas | clé Supabase erronée | recopier `NEXT_PUBLIC_SUPABASE_ANON_KEY` en entier |
