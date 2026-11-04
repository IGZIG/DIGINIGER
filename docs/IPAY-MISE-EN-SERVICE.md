# Brancher IPay Money — la solution nigérienne

## Pourquoi IPay

IPay Money (iMoney Encaissement) est développé par **i-FUTUR**, fintech de Niamey **agréée établissement de paiement par la BCEAO**. C'est le seul agrégateur de premier rang qui couvre réellement le Niger :

- **Airtel Money** (~52 % du marché nigérien)
- **Moov Money** (~15 %)
- **Zamani Cash**
- **Cartes Visa / Mastercard / GIM UEMOA**
- Plusieurs banques locales (BOA, Ecobank Xpress, Orabank, BIA, Coris, Nita, SPI)

Contact commercial : **+227 87 50 50 50** — inscription en ligne sur **[i-pay.money/register](https://i-pay.money/register)**

Comparé aux autres options :

| Solution | Niger | Remarque |
| --- | --- | --- |
| **IPay Money** | ✔ | Agrégateur local, un seul contrat, API REST documentée |
| CinetPay | ✔ | 8 pays, XOF, adaptateur également prêt dans le code |
| Orange / Airtel en direct | ✔ | 14 à 28 jours d'ouverture, un contrat par opérateur |
| PayDunya | ✘ | Niger non couvert |

---

## Ce qui est déjà fait dans l'application

| Élément | État |
| --- | --- |
| Adaptateur IPay (`POST /payments`, `GET /payments/{ref}`) | ✔ écrit |
| En-têtes officiels (`Bearer`, `Ipay-Payment-Type`, `Ipay-Target-Environment`) | ✔ |
| Pays `NE`, devise `XOF`, montant minimum 100 XOF, numéro obligatoire | ✔ contrôlés avant l'appel |
| Vérification de l'en-tête `Secret-Hash` (comparaison à temps constant) | ✔ |
| **Confirmation serveur-à-serveur obligatoire** avant d'ouvrir un cours | ✔ |
| Idempotence (une notification rejouée ne crédite pas deux fois) | ✔ |
| Refus des montants forgés | ✔ |
| Bouton « Tester la connexion » dans l'administration | ✔ |
| 8 scénarios de test dédiés à IPay | ✔ **26/26 au vert** |

### Les 8 scénarios testés sans compte marchand

1. `Secret-Hash` absent → **401**
2. Notification valide + consultation IPay « succeeded » → **accès ouvert**
3. Rejeu de la même notification → **ignoré**
4. Notification qui prétend « succeeded » mais la consultation IPay dit « pending » → **accès refusé**
5. Montant confirmé ≠ montant en base → **409**
6. `Secret-Hash` invalide → **401**
7. Transaction inconnue → **200 sans action**
8. Fournisseur injoignable → **502**, aucun crédit

C'est le point le plus important : chez IPay, **la réponse à la création d'un paiement ne prouve rien**. Notre code ne l'utilise jamais comme preuve ; il interroge IPay après chaque notification.

---

## Ce que vous devez faire (15 minutes)

### 1. Créer le compte marchand

**[i-pay.money/register](https://i-pay.money/register)**
Documents à prévoir : pièce d'identité, numéro de téléphone, RCCM et NIF de l'entreprise.

### 2. Récupérer la clé privée

Tableau de bord → **Développeurs** → **Clés d'API**.

| Nom IPay | Nom dans l'application |
| --- | --- |
| Clé privée (privée, commence souvent par `sk_`) | `IPAY_PRIVATE_KEY` |
| Clé publique | `IPAY_PUBLIC_KEY` (facultative ici) |

### 3. Créer le webhook

Tableau de bord → **Développeurs** → **Webhooks** → **Ajouter** :

- **URL** : `https://diginiger.vercel.app/api/payments/webhook?provider=mobile_money`
- **Hash secret** : choisissez une phrase longue et unique, par exemple
  `diginiger-ipay-9f3c2b7a5e`
  → c'est la valeur que je mettrai dans `IPAY_WEBHOOK_SECRET`
- Cochez au minimum : **Événements réussis** et **Événements échoués**

### 4. L'étape que tout le monde oublie

La documentation IPay est claire : **un webhook qui échoue n'est jamais rejoué**. C'est pourquoi l'application ne dépend pas uniquement de la notification — la page de retour et la consultation directe du statut rattrapent le coup. Vérifiez donc aussi que la page `/paiement/retour` reste accessible.

---

## Les 3 valeurs à m'envoyer

```
IPAY_PRIVATE_KEY=…
IPAY_WEBHOOK_SECRET=…
IPAY_ENVIRONMENT=sandbox      (ou "live" quand vous passerez en réel)
```

---

## Mon conseil de calendrier

IPay Money est la **seule solution qui parle Airtel Money, Moov et Zamani en une fois** au Niger. Commencez par elle. Gardez CinetPay comme second fournisseur de secours : l'adaptateur est déjà écrit et testé, il suffit d'ajouter ses clés.

---

## Sécurité déjà en place

- Le montant facturé est celui enregistré en base, jamais celui envoyé par le navigateur.
- L'en-tête `Secret-Hash` est un secret **statique** partagé (pas un HMAC du corps) : il ne prouve pas l'intégrité du message, donc il ne sert que de premier filtre.
- La consultation `GET /payments/{reference}` est la seule source qui ouvre un accès.
- Notifications rejouées ignorées, tentatives rejetées journalisées.
- Sans clé : réponse **503** explicite, jamais de fausse réussite.
