# Activer le tuteur IA — état au 3 novembre 2026

## En une phrase

La clé OpenAI est **branchée et vérifiée**. Il manque **du crédit sur le compte OpenAI** : tant qu'il n'y en a pas, le tuteur refuse de répondre (et le dit) au lieu d'inventer.

---

## Ce qui est fait

| Étape | État |
| --- | --- |
| Clé OpenAI testée directement chez OpenAI | ✔ valide, 128 modèles accessibles |
| Modèles attendus présents | ✔ `gpt-4o-mini` (réponses) et `text-embedding-3-small` (recherche) |
| Clé posée dans Vercel (Production + Aperçu) | ✔ stockée chiffrée |
| Modèles configurés | ✔ `OPENAI_CHAT_MODEL`, `OPENAI_EMBEDDING_MODEL` |
| Redéploiement | ✔ en ligne, alias `diginiger.vercel.app` |
| Nouvelle page « Base de connaissances » dans l'admin | ✔ créée |
| Messages d'erreur en français clair | ✔ (crédit, clé révoquée, quota, modèle) |
| 100 contrôles automatiques | ✔ 15 + 58 + 9 + 18, aucun échec |
| Test réel de la clé dans l'application | ✔ la clé est lue, l'appel part, OpenAI répond « plus de crédit » |

### Le message exact renvoyé par OpenAI

```
429 — credit_balance_exhausted
You have no credits remaining. Add credits to continue using the API.
```

Ce n'est **pas** un problème de clé, ni de code : c'est le solde du compte.

---

## La seule action qui reste

1. Ouvrir **[platform.openai.com/settings/organization/billing](https://platform.openai.com/settings/organization/billing)**
2. Cliquer **Add payment method** (carte bancaire) puis **Add credits**
3. Choisir **5 $** minimum — c'est très largement suffisant
4. Répondre « crédit ajouté » ici

Je relance alors le diagnostic et l'indexation, et je vous confirme la réponse du tuteur.

### Ce que 5 $ permettent

| Opération | Coût unitaire | Pour 5 $ |
| --- | --- | --- |
| Une question au tuteur | ~0,0003 $ | ~16 000 questions |
| Indexation complète des 13 cours | ~0,02 $ | une seule fois |

---

## Comment vérifier vous-même, après avoir ajouté du crédit

1. Aller sur **diginiger.vercel.app/connexion**
2. Se connecter : `admin.demo@diginiger.test` / `Diginiger2026!`
3. Menu **Paramètres** (`/admin/parametres`)
4. Section **Moteur IA** → bouton **Lancer le diagnostic**
   - Attendu : « complétion OK » et « embeddings OK (1536 dimensions) »
5. Section **Base de connaissances du tuteur** → bouton **Indexer les documents en attente**
   - Chaque clic traite 3 cours ; répéter jusqu'à 13/13 et 100 %
6. Se déconnecter, se reconnecter en `etudiant.demo@diginiger.test` / `Diginiger2026!`
7. Aller sur **diginiger.vercel.app/app/tuteur-ia** et poser une question

---

## Ce que j'ai corrigé au passage

Trois défauts réels découverts en testant, tous corrigés :

1. **Aucun moyen d'indexer les cours depuis le site.** L'indexation n'existait que dans un script local. Nouvelle page d'administration avec barre de progression.
2. **Le schéma de données n'était pas celui supposé.** Les documents n'ont pas de champ `description` ; le contenu des cours vit dans les leçons, reliées par les modules. La route lit désormais la bonne source et crée la fiche documentaire manquante pour chaque cours.
3. **Statut invalide.** La base n'accepte que `pending`, `indexed`, `failed` ; le code écrivait `error`, ce qui faisait échouer silencieusement l'enregistrement des erreurs.

---

## Sécurité

- La clé OpenAI n'est écrite dans aucun fichier du dépôt GitHub.
- Elle est stockée dans Vercel en type « sensitive » : elle n'est plus affichable, même par vous.
- Le navigateur ne la voit jamais : tous les appels partent du serveur.
- Le jeton GitHub utilisé pour l'envoi du code est à révoquer : [github.com/settings/tokens](https://github.com/settings/tokens).
- La clé OpenAI a circulé dans une conversation : elle est fonctionnelle aujourd'hui, mais vous pouvez la remplacer par une clé neuve quand vous voulez (je la remplace en une minute).
