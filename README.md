# DIGINIGER — plateforme d'apprentissage

Académie numérique pour le Niger et l'Afrique de l'Ouest : catalogue de formations,
tuteur IA ancré dans les contenus validés, certificats vérifiables, espace formateur
et administration.

- **Stack** : Next.js 15 (App Router, Server Actions), TypeScript strict, Tailwind CSS,
  Supabase (Auth, PostgreSQL, Storage, RLS), Recharts, pdf-lib + qrcode.
- **Trois interfaces de rôle** : `/app` (apprenant), `/formateur`, `/admin`.
- **Bilingue FR/EN** (cookie `diginiger_locale`, français par défaut).

## Démarrage

```bash
npm install
cp .env.example .env.local     # puis renseigner les clés Supabase
npm run doctor                 # dit exactement ce qui manque
npm run migrate                # applique les 12 migrations
npm run seed                   # données + comptes de démonstration
npm run dev
```

## Vérification complète

```bash
npm run typecheck
npm run build
npm run start            # dans un terminal
npm run check            # 100 vérifications : base, interface, actions, paiement
npm run ai:check         # le moteur IA répond-il vraiment ? (après avoir mis la clé)
npm run ai:index         # indexe les supports pédagogiques pour le tuteur RAG
npm run payments:sandbox # 18 contrôles de paiement sans compte marchand
```

Comptes de démonstration (mot de passe `Diginiger2026!`) : `admin.demo@diginiger.test`,
`aissatou.demo@diginiger.test` (formateur), `etudiant.demo@diginiger.test` (apprenant).

## Documentation

- [`docs/ETAT-DU-PRODUIT.md`](docs/ETAT-DU-PRODUIT.md) — périmètre réel, architecture, reste à faire.
- [`docs/ACTIVER-LES-CLES.md`](docs/ACTIVER-LES-CLES.md) — **activer de votre côté, pas à pas**
  (OpenAI, PayDunya, Vercel) et erreurs fréquentes.
- [`docs/INTEGRATIONS-IA-ET-PAIEMENT.md`](docs/INTEGRATIONS-IA-ET-PAIEMENT.md) — référence technique
  des intégrations et des garanties de sécurité.

## Honnêteté fonctionnelle

Sans `OPENAI_API_KEY` ou sans clés d'agrégateur, le tuteur IA et le paiement répondent
explicitement **« non configuré » (503)**. Aucun succès n'est simulé, aucune donnée n'est inventée.
Côté paiement, une notification n'ouvre jamais un accès à elle seule : elle est confirmée par un
appel serveur-à-serveur (indispensable chez PayDunya, dont le hash d'IPN est statique).
