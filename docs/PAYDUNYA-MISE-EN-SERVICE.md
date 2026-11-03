# Brancher PayDunya — pas à pas

## Où en est le code

Tout est prêt et testé côté application. Le branchement ne dépend plus que de **vos clés**.

| Élément | État |
| --- | --- |
| Adaptateur PayDunya (création de facture, notification, confirmation) | ✔ écrit et testé |
| Création de facture réelle (`/checkout-invoice/create`) | ✔ |
| Notification signée (IPN) + idempotence | ✔ 18 scénarios au vert |
| Confirmation serveur-à-serveur obligatoire avant d'ouvrir l'accès | ✔ |
| Montant relu en base, refus si écart | ✔ |
| Bouton « Tester la connexion » dans l'administration | ✔ nouveau |
| Refus explicite (503) si les clés manquent | ✔ |

### Ce qui a été vérifié en vrai, contre PayDunya

Le contrôle a été lancé avec de **fausses** clés. PayDunya a répondu :

```json
{"response_code":"1001","response_text":"Invalid Masterkey Specified"}
```

L'application a correctement traduit : *« Le fournisseur refuse ces clés. »*
Cela prouve que la connexion, l'authentification et la lecture des réponses fonctionnent : il ne manque que les bonnes clés.

---

## Ce que vous devez faire sur PayDunya (10 minutes)

### 1. Créer le compte

**[paydunya.com](https://paydunya.com)** → **Créer un compte** (gratuit, pièce d'identité et numéro de téléphone demandés).

### 2. Créer l'application « DIGINIGER »

Dans le tableau de bord → onglet **Mes applications** → **Créer une application** :

- Nom : `DIGINIGER`
- Site web : `https://diginiger.vercel.app`
- Activité : formation en ligne

### 3. Récupérer les 4 valeurs

Dans l'application créée → onglet **Clés d'API**. Copiez :

| Nom PayDunya | Nom dans notre application |
| --- | --- |
| Master Key | `PAYDUNYA_MASTER_KEY` |
| Private Key | `PAYDUNYA_PRIVATE_KEY` |
| Public Key | (non utilisée, gardez-la) |
| Token | `PAYDUNYA_TOKEN` |

### 4. Basculer en mode test

Onglet **Intégration** → activez **Mode test**. Les clés de test et les clés réelles sont différentes : les deux doivent être cohérentes, sinon vous obtiendrez `Invalid Masterkey`.

### 5. Déclarer l'adresse de notification

Onglet **IPN** (ou « Callback ») → collez exactement :

```
https://diginiger.vercel.app/api/payments/webhook?provider=mobile_money
```

---

## Ce que je fais dès que j'ai les clés

1. Je teste les clés **directement chez PayDunya** avant de les installer.
2. Je les place dans Vercel (`PAYDUNYA_MASTER_KEY`, `PAYDUNYA_PRIVATE_KEY`, `PAYDUNYA_TOKEN`, `PAYMENT_PROVIDER=paydunya`, `PAYDUNYA_MODE=test`).
3. Je redéploie.
4. Je lance le bouton **Tester la connexion** depuis l'administration et je vous montre la réponse.
5. Vous faites un paiement test de 100 FCFA depuis `/paiement`, et je vérifie que l'accès au cours s'ouvre **uniquement** après confirmation de PayDunya.

### Passage en réel

Quand les tests sont concluants : je remplace les clés par les clés **live**, je passe `PAYDUNYA_MODE=live`, et je vous confirme que le bouton de contrôle répond « clés acceptées » sur le serveur de production PayDunya.

---

## Sécurité déjà en place

- Le montant facturé est celui enregistré en base, jamais celui envoyé par le navigateur.
- Une notification PayDunya ne suffit jamais : le serveur rappelle PayDunya pour confirmer, et seul ce retour ouvre l'accès.
- Le « hash » de PayDunya est un SHA-512 de la clé principale, identique à chaque message : il sert de premier filtre, pas de preuve.
- Les notifications rejouées sont ignorées (idempotence).
- Sans clés, l'application répond **503** et n'affiche jamais une fausse réussite.

---

## Les 6 erreurs fréquentes et leur solution

| Message affiché | Cause | Solution |
| --- | --- | --- |
| `Invalid Masterkey Specified` | clé principale fausse ou clés test/live mélangées | recopier les 4 clés du même mode |
| `Invalid Token` | jeton de boutique d'un autre compte | recréer l'application |
| `PAYMENT_NOT_CONFIGURED` (503) | une des 3 variables manque | vérifier `PAYDUNYA_MASTER_KEY`, `PAYDUNYA_PRIVATE_KEY`, `PAYDUNYA_TOKEN` |
| Paiement réussi mais accès fermé | notification non reçue | vérifier l'adresse IPN déclarée chez PayDunya |
| `AMOUNT_MISMATCH` (409) | montant de la notification ≠ montant en base | signale une tentative de fraude : ne pas ignorer |
| Rien ne se passe après le paiement | mode test activé chez PayDunya | basculer en mode réel |
