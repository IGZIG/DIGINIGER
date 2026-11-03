# Mise en service — IA (OpenAI) et paiement Mobile Money

> Les clés ne sont pas dans mon environnement. Tout le code est en place et **testé avec de vrais
> contrats de fournisseurs** (bac à sable pour le paiement, diagnostic à froid pour l'IA). Il ne
> manque que les identifiants, à coller dans `.env.local` ou dans Vercel.
>
> Vérifications actuelles sans clé : `15/15` base + `58/58` interface + `9/9` actions +
> `18/18` paiement simulé = **100 contrôles verts**.

---

## 1. Activer l'intelligence artificielle

### 1.1 Ce qui a été construit

| Élément | Fichier | Rôle |
| --- | --- | --- |
| Noyau IA multi-fournisseurs | `src/lib/ai/tutor.ts` | OpenAI ou tout endpoint compatible OpenAI, dimension d'embedding vérifiée |
| Diagnostic à froid | `scripts/ai-check.mjs`, `GET /api/ai/diagnostic` | appel réel + contrôle de la dimension des vecteurs |
| Indexation RAG | `scripts/index-knowledge.mjs` | découpe les leçons validées, calcule les embeddings, remplit `document_chunks` |
| Bouton de contrôle | `/admin/parametres` → « Lancer le diagnostic » | prouve au dirigeant que le moteur répond |

Le tuteur ne répond qu'à partir des passages indexés
(`match_course_chunks`, seuil de similarité 0.72) : il n'invente rien, et sans clé il renvoie un
**503 explicite** au lieu d'une réponse factice.

### 1.2 Marche à suivre (5 minutes)

```bash
# 1. Clé API OpenAI : https://platform.openai.com/api-keys
#    (ou AI_PROVIDER=compatible + AI_BASE_URL=… pour Azure/OpenRouter/Groq/Mistral/local)

# 2. Renseigner .env.local (ou les variables d'environnement Vercel)
OPENAI_API_KEY=sk-...
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=1536

# 3. Vérifier réellement que le moteur répond
npm run ai:check

# 4. Indexer les supports pédagogiques (117 leçons de démonstration)
npm run ai:index

# 5. Redémarrer l'application, puis tester dans /app/tuteur-ia
```

`npm run ai:index` est idempotent : il supprime les passages existants d'un document avant de les
recréer, et refuse d'insérer si la dimension ne correspond pas à la colonne `vector(1536)`.

### 1.3 Coût et garde-fous

- `text-embedding-3-small` : environ **0,02 $** pour les 117 leçons de démonstration.
- `gpt-4o-mini` : ~0,15 $ / million de jetons d'entrée.
- Garde-fous déjà actifs : 10 requêtes / 5 min par utilisateur (`take_rate_limit`), quota quotidien
  par offre (`consume_ai_quota`), 5 générations de formation / heure, contexte limité aux cours
  auxquels l'apprenant a réellement accès (`can_access_course`), aucun message client stocké côté
  navigateur (persistance en `service_role`).

### 1.4 Si vous changez de modèle d'embedding

`text-embedding-3-large` produit 3072 dimensions alors que la colonne attend 1536. Deux options :

1. garder `text-embedding-3-small` (recommandé : dimension native, aucun coût de migration) ;
2. ou demander `dimensions: 1536` au fournisseur — l'adaptateur le fait déjà pour les familles
   OpenAI v3 — puis réindexer (`npm run ai:index --all`).

Un modèle d'une autre famille (Mistral, Cohere…) impose une migration
`alter table document_chunks alter column embedding type vector(<n>)` + réindexation complète.

---

## 2. Activer le paiement Mobile Money

### 2.1 Ce qui a été construit

| Élément | Détail |
| --- | --- |
| Adaptateur PayDunya | `checkout-invoice/create`, IPN `data.hash`, confirmation `checkout-invoice/confirm` |
| Adaptateur CinetPay | `/v2/payment`, notification `cpm_*`, vérification `/v2/payment/check`, `x-token` HMAC |
| Adaptateur générique | agrégateur maison, signature HMAC `t=<unix>,v1=<hex>` |
| Webhook durci | `src/app/api/payments/webhook/route.ts` |
| Bac à sable | `scripts/payment-sandbox.mjs` (18 contrôles, sans compte marchand) |

Trois règles appliquées, quel que soit l'agrégateur :

1. **Le montant vient de la base**, jamais du client. Écart entre le montant confirmé et le montant
   enregistré → `409`, aucun accès.
2. **La notification n'ouvre rien à elle seule** : elle est confirmée par un appel serveur-à-serveur.
   C'est indispensable chez **PayDunya** : l'IPN contient `sha512(master key)`, une valeur
   **statique et identique à chaque notification**, qui ne couvre ni le montant ni le statut. Une
   seule fuite de log permettrait de forger des notifications « valides ». Notre bac à sable le
   prouve : une notification forgée avec le bon hash mais un montant mensonger est rejetée.
3. **Idempotence** par `event_id` en base (contrainte `UNIQUE`) : un rejeu ne crédite jamais deux fois.

### 2.2 Marche à suivre (PayDunya, recommandé pour le Niger)

```bash
# 1. Compte marchand : https://app.paydunya.com  → Intégrations > Clés
#    Récupérer : Master Key, Private Key, Token

# 2. .env.local (ou Vercel → Settings → Environment Variables)
PAYMENT_PROVIDER=paydunya
PAYDUNYA_MODE=test            # passer à "live" en production
PAYDUNYA_MASTER_KEY=...
PAYDUNYA_PRIVATE_KEY=...
PAYDUNYA_TOKEN=...

# 3. Déclarer l'URL de notification (IPN) dans le tableau de bord PayDunya
#    https://<votre-domaine>/api/payments/webhook?provider=mobile_money

# 4. Vérifier l'état vu par l'application
#    /admin/paiements → « Fournisseur Mobile Money : paydunya · configuré »

# 5. Test réel de bout en bout (mode test PayDunya : aucun argent débité)
```

Alternative **CinetPay** (Mobile Money + cartes, présent au Niger) :

```bash
PAYMENT_PROVIDER=cinetpay
CINETPAY_API_KEY=...
CINETPAY_SITE_ID=...
CINETPAY_SECRET_KEY=...       # active la vérification de l'en-tête x-token
# notify_url à déclarer : https://<domaine>/api/payments/webhook?provider=mobile_money
```

### 2.3 Ce que le bac à sable a prouvé (`npm run payments:sandbox`)

| Scénario | Résultat attendu | Obtenu |
| --- | --- | --- |
| Notification valide + confirmation `completed` | accès ouvert, transaction `paid` | ✅ |
| Rejeu de la même notification | un seul événement, aucun double crédit | ✅ |
| Notification **forgée** (bon hash, mauvais montant) | `409`, aucune inscription | ✅ |
| Montant confirmé ≠ montant en base | `409`, aucun accès | ✅ |
| Hash PayDunya invalide | `401` | ✅ |
| Transaction inconnue | `200 matched:false`, rien d'ouvert | ✅ |
| Fournisseur injoignable à la confirmation | `502` (rejeu attendu), aucun accès | ✅ |
| CinetPay : `x-token` invalide | `401` | ✅ |
| CinetPay : notification valide | accès ouvert après confirmation | ✅ |

Le script démarre lui-même deux instances applicatives (une par fournisseur) pointant vers un faux
agrégateur local, puis nettoie en base les données qu'il a créées.

### 2.4 Après le premier paiement réel — à vérifier

1. La transaction apparaît en `/admin/paiements` avec le statut **payé**.
2. L'apprenant a bien accès au cours (`/app/mes-formations`) ou l'abonnement est actif.
3. `payment_events` contient l'événement avec `processed_at` renseigné.
4. Un remboursement se traite depuis `/admin/paiements` (RPC `process_refund`, atomique).

---

## 3. Variables d'environnement (récapitulatif)

```ini
# IA
AI_PROVIDER=openai            # ou compatible
AI_BASE_URL=                  # si compatible / proxy
OPENAI_API_KEY=
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=1536

# Paiement PayDunya
PAYMENT_PROVIDER=paydunya
PAYDUNYA_MODE=test
PAYDUNYA_MASTER_KEY=
PAYDUNYA_PRIVATE_KEY=
PAYDUNYA_TOKEN=

# Paiement CinetPay (alternative)
CINETPAY_API_KEY=
CINETPAY_SITE_ID=
CINETPAY_SECRET_KEY=

# Adaptateur générique / carte
PAYMENT_WEBHOOK_SECRET=
PAYMENT_API_URL=
PAYMENT_API_KEY=
CARD_API_URL=
CARD_API_KEY=
CARD_WEBHOOK_SECRET=
```

En production sur Vercel : définir ces variables pour l'environnement *Production*, puis redéployer
(les variables lues au démarrage ne sont pas rechargées à chaud).

---

## 4. Commandes utiles

```bash
npm run ai:check             # le moteur IA répond-il vraiment ?
npm run ai:index             # indexe les documents en attente
npm run ai:index -- --all    # réindexe tout (après changement de modèle)
npm run payments:sandbox     # 18 contrôles de paiement, sans compte marchand
npm run check                # toutes les suites : base + interface + actions + paiement
```

## 5. Reste ouvert (hors périmètre de ce tour)

- **Emails transactionnels** (reçus, confirmations) : dépend d'un fournisseur SMTP.
- **Remboursement automatique côté agrégateur** : aujourd'hui le remboursement est décidé et
  enregistré côté plateforme ; l'appel de remboursement à l'API du fournisseur reste à brancher
  quand un compte marchand réel sera disponible.
- **Tests navigateur** (Playwright) : les parcours sont validés par HTTP + base, pas encore par clic.
