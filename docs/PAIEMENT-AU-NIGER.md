# Paiement Mobile Money au Niger — quelle solution ?

## Le constat

**PayDunya ne couvre pas le Niger.** Ses 4 pays sont le Sénégal, la Côte d'Ivoire, le Burkina Faso, le Bénin, le Togo et le Mali. Niger absent.

**CinetPay couvre le Niger** : Burkina Faso, Bénin, Côte d'Ivoire, Cameroun, Mali, **Niger**, Sénégal, Togo — en franc CFA (XOF), avec Airtel Money, Orange Money, Moov Money et les cartes Visa/Mastercard.

➡️ **La solution retenue est donc CinetPay**, et le code est déjà prêt pour elle.

---

## Ce qui est déjà fait, côté application

| Élément | État |
| --- | --- |
| Adaptateur CinetPay (création de facture, notification, confirmation) | ✔ écrit et testé |
| Priorité donnée à CinetPay dans la détection automatique | ✔ corrigé aujourd'hui |
| Pays de paiement réglé sur le Niger (`NE`, Niamey) | ✔ ajouté aujourd'hui |
| Réponse au ping GET de CinetPay (sinon aucune notification n'arrive) | ✔ ajouté aujourd'hui |
| Bouton « Tester la connexion » dans l'administration | ✔ |
| Confirmation serveur-à-serveur obligatoire avant d'ouvrir un cours | ✔ |
| 100 contrôles automatiques | ✔ tous au vert |

---

## Ce que vous devez faire chez CinetPay (15 minutes)

### 1. Créer le compte marchand

**[cinetpay.com](https://cinetpay.com)** → **Créer un compte**.
Prévoyez : pièce d'identité du responsable, numéro de téléphone, et si possible le **RCCM** et le **NIF** (nécessaires pour encaisser réellement au Niger).

### 2. Créer le site « DIGINIGER »

Dans le tableau de bord → **Sites / Mes sites** → créer :

- Nom : `DIGINIGER`
- Adresse : `https://diginiger.vercel.app`
- Devise : **XOF**
- Pays : **Niger**

### 3. Récupérer les 3 valeurs

Onglet **Intégration** du site créé :

| Nom CinetPay | Nom dans notre application |
| --- | --- |
| API Key | `CINETPAY_API_KEY` |
| Site ID | `CINETPAY_SITE_ID` |
| Secret Key | `CINETPAY_SECRET_KEY` (sert à vérifier la signature) |

### 4. Déclarer l'adresse de notification

Champ **Notify URL** / **URL de notification** :

```
https://diginiger.vercel.app/api/payments/webhook?provider=mobile_money
```

Cette adresse répond déjà correctement au **ping GET** que CinetPay envoie avant tout paiement.

---

## Les 4 valeurs à m'envoyer

```
CINETPAY_API_KEY=…
CINETPAY_SITE_ID=…
CINETPAY_SECRET_KEY=…
```

Je les teste **directement chez CinetPay** avant de les installer, puis je vous montre la réponse du bouton « Tester la connexion ».

---

## Une limite technique à connaître

Mon environnement de travail ne peut pas joindre les serveurs de CinetPay (nom de domaine non résolu depuis mon bac à sable ; PayDunya, lui, répondait). Conséquence :

- **Je ne peux pas tester CinetPay avant de déployer**, seulement après, depuis Vercel.
- Le bouton « Tester la connexion » dans l'administration, lui, tourne sur Vercel : il fonctionnera normalement.

Autrement dit : le premier vrai contrôle des clés CinetPay se fera **sur le site en ligne**, pas chez moi. C'est sans risque : aucune facture n'est créée par ce contrôle.

---

## Les alternatives, si CinetPay ne vous convient pas

| Solution | Niger | Remarque |
| --- | --- | --- |
| **CinetPay** | ✔ | Le plus simple. Mobile Money + cartes, XOF. |
| Orange Money Niger (API marchand) | ✔ | Documentation OpenAPI et bac à sable libre-service. Délai d'ouverture : 14-21 jours ouvrés. |
| Airtel Money Niger | ✔ | ~52 % du marché. Ouverture 21-28 jours ouvrés, dossier KYB. |
| Moov Money Niger | ✔ | ~15 % du marché. Ouverture 30-45 jours ouvrés. |
| Bizao / GetMiPay / YengaPay | ✔ | Agrégateurs alternatifs, à comparer sur les frais. |
| PayDunya | ✘ | Niger non couvert. |

Mon conseil : commencer par **CinetPay** (un seul contrat, un seul flux de notifications), et n'ajouter un opérateur en direct que si les frais le justifient plus tard.

---

## Sécurité déjà en place

- Le montant facturé est celui enregistré en base, jamais celui envoyé par le navigateur.
- Une notification CinetPay ne suffit jamais : le serveur rappelle CinetPay (`/v2/payment/check`) et seul ce retour ouvre l'accès — CinetPay le recommande explicitement.
- Les notifications rejouées sont ignorées (idempotence par identifiant d'événement).
- Signature `x-token` vérifiée si la Secret Key est fournie.
- Sans clés : réponse **503** explicite, jamais de fausse réussite.
