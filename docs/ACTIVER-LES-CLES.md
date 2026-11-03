# Activer de votre côté — pas à pas

Vous n'avez **rien à coder**. Il y a deux fichiers à modifier (ou deux écrans si vous déployez sur
Vercel), puis trois commandes de vérification.

> Commencez toujours par : `npm run doctor`
> Il lit votre `.env.local` et vous dit exactement ce qui manque, sans se connecter à rien.

---

## Étape 0 — Où se trouvent vos secrets

| Où vous travaillez | Fichier / écran à modifier |
| --- | --- |
| En local (le workspace) | `/home/user/diginiger/.env.local` |
| Sur Vercel | Projet → **Settings** → **Environment Variables** (environnement *Production*) |

**Règle absolue** : `.env.local` n'est jamais commité (il est dans `.gitignore`) et la clé
`service_role` ne doit jamais apparaître côté navigateur. Toutes les clés ci-dessous sont lues
uniquement par le serveur.

---

## Étape 1 — L'IA (5 minutes)

1. Connectez-vous sur **https://platform.openai.com/api-keys** → *Create new secret key*.
2. Copiez la clé (`sk-…`). Elle ne sera **plus jamais affichée** : gardez-la.
3. Ajoutez dans votre fichier de configuration :

```ini
OPENAI_API_KEY=sk-votre-cle
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

4. Vérifiez que le moteur répond **vraiment** (appel réel, coût < 0,001 $) :

```bash
npm run ai:check
```

Attendu :

```
1. Complétion de test… ✅ « OK » (gpt-4o-mini)
2. Embedding de test… ✅ 1536 dimensions
3. Recherche vectorielle en base… ⚠️  aucun passage indexé
```

5. Indexez les supports pédagogiques (les 117 leçons) pour que le tuteur cite de vrais extraits :

```bash
npm run ai:index
```

Attendu : `✔ Support de cours — … — 12 passages indexés` pour chaque document, puis un récapitulatif.

6. Redémarrez l'application, ouvrez **`/app/tuteur-ia`** et posez une question sur un cours.
   Si vous voyez « Le tuteur IA n'est pas encore activé », c'est que l'étape 3 n'a pas été rechargée :
   relancez le serveur (une variable d'environnement n'est lue qu'au démarrage).

**Remarque budget** : indexer les 117 leçons coûte environ **0,02 $**, et une question du tuteur
environ **0,0003 $**. Les quotas par offre (10 messages/jour en gratuit) et la limite de
10 questions / 5 minutes sont déjà actifs.

---

## Étape 2 — Le paiement Mobile Money (PayDunya)

### 2.1 Ouvrir le compte marchand

1. **https://app.paydunya.com** → *Créer un compte*.
2. Renseignez votre activité (académie de formation en ligne, Niger).
3. PayDunya vous fournit un **environnement de test** immédiatement ; le passage en *live* demande
   la validation du compte (pièces d'entreprise). **Commencez en test** : aucun argent réel ne circule.

### 2.2 Récupérer les trois clés

Dans le tableau de bord : **Intégrations → Clés** (parfois nommé *API Keys*). Vous y trouvez :

| Clé PayDunya | Variable à créer |
| --- | --- |
| Master Key | `PAYDUNYA_MASTER_KEY` |
| Private Key | `PAYDUNYA_PRIVATE_KEY` |
| Token | `PAYDUNYA_TOKEN` |

```ini
PAYMENT_PROVIDER=paydunya
PAYDUNYA_MODE=test
PAYDUNYA_MASTER_KEY=…
PAYDUNYA_PRIVATE_KEY=…
PAYDUNYA_TOKEN=…
```

### 2.3 Déclarer l'URL de notification (l'étape que tout le monde oublie)

Dans PayDunya, champ *IPN / Callback URL* (ou *URL de notification*), collez :

```
https://VOTRE-DOMAINE/api/payments/webhook?provider=mobile_money
```

En local, PayDunya ne peut pas joindre `localhost` : utilisez un tunnel
(`npx localtunnel --port 3000` ou `ngrok http 3000`) et déclarez l'URL du tunnel.
En production, `VOTRE-DOMAINE` est votre domaine Vercel, et `NEXT_PUBLIC_SITE_URL` doit pointer dessus.

### 2.4 Vérifier

```bash
npm run doctor        # doit afficher : Paiement Mobile Money ✅ activé
```

Puis dans l'application, **`/admin/paiements`** : la ligne « Fournisseur Mobile Money » doit indiquer
`paydunya · configuré`.

### 2.5 Faire un paiement test

1. Connectez-vous avec un compte de démonstration, ouvrez un cours payant → *S'inscrire*.
2. Vous êtes redirigé vers la page de paiement PayDunya (mode test : choisissez « réussir »).
3. Au retour, la transaction doit apparaître **payée** dans `/admin/paiements`, et le cours dans
   `/app/mes-formations`.

Si la transaction reste **en attente** : c'est presque toujours l'URL de notification (étape 2.3).
Les notifications refusées sont visibles dans la table `payment_events` (`error =
CONFIRMATION_UNAVAILABLE`, `INVALID_SIGNATURE`, `AMOUNT_MISMATCH`).

### 2.6 Passer en production

```ini
PAYDUNYA_MODE=live
```

et remplacez les clés de test par les clés de production. Refaites un paiement réel de faible montant
pour confirmer, puis remboursez-le.

### Variante CinetPay (Mobile Money + cartes)

```ini
PAYMENT_PROVIDER=cinetpay
CINETPAY_API_KEY=…
CINETPAY_SITE_ID=…
CINETPAY_SECRET_KEY=…     # active la vérification de l'en-tête x-token
```

Même URL de notification. `npm run doctor` détecte automatiquement le fournisseur.

---

## Étape 3 — Sur Vercel (si vous déployez)

1. Poussez le code sur GitHub, importez le dépôt dans Vercel.
2. **Settings → Environment Variables** : ajoutez *toutes* les variables de votre `.env.local`
   **sauf** les `SUPABASE_DB_*` (inutiles en production) — elles servent seulement aux scripts locaux.
3. Mettez `NEXT_PUBLIC_SITE_URL=https://votre-domaine.vercel.app`.
4. **Redéployez** : les variables ne sont lues qu'au démarrage d'un nouveau déploiement.
5. Déclarez l'IPN PayDunya avec le domaine de production (étape 2.3).

---

## Récapitulatif des commandes

```bash
npm run doctor           # que manque-t-il ? (ne se connecte à rien)
npm run ai:check         # le moteur IA répond-il vraiment ?
npm run ai:index         # indexe les supports du tuteur (RAG)
npm run check            # 100 vérifications, dont 18 de paiement simulé
```

## Les erreurs les plus fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| « non configuré » alors que la clé est là | serveur non redémarré | relancer `npm run dev` / redéployer |
| `AI_NOT_CONFIGURED` sur `/api/ai/chat` | `OPENAI_API_KEY` absente ou vide | étape 1 |
| `EMBEDDING_DIMENSION_MISMATCH` | modèle d'embedding ≠ 1536 dim. | garder `text-embedding-3-small` |
| Paiement reste « en attente » | URL IPN non déclarée ou tunnel fermé | étape 2.3 |
| `AMOUNT_MISMATCH` dans `payment_events` | montant confirmé ≠ montant en base | normal : la protection a joué, vérifier la transaction |
| `401` sur le webhook | signature/hash refusé | vérifier les clés `PAYDUNYA_*` |

## Ce qui marche sans aucune clé

Cours, modules, leçons, examens, progression, certificats vérifiables, espaces étudiant / formateur /
administrateur, validation éditoriale, bilingue FR/EN. Seuls le tuteur IA, le générateur de formations
et le paiement affichent « non configuré » — sans jamais simuler un succès.
