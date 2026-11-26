# Architecture technique de Kavelyo

## Cibles d’exécution

- Web : React/Vite, Supabase Auth, PostgreSQL et Storage.
- Desktop : Electron avec choix au premier lancement entre le mode local SQLite et le mode connecté Supabase.
- Base partagée : le même modèle métier est conservé pour limiter les divergences entre le web et le Desktop.

La migration `supabase/migrations/202611190001_initial_saas.sql` constitue la source de vérité du schéma cloud. Toutes les tables partagées sont protégées par des politiques de sécurité basées sur l’appartenance à un espace de travail.

## Organisation générale

Kavelyo sépare l’interface utilisateur, les fonctionnalités métier, les services desktop et la persistance locale. Cette organisation limite les dépendances entre modules et facilite les évolutions.

```text
src/
├── features/       Modules métier autonomes
├── services/       Accès aux services exposés par Electron
├── shared/         Composants génériques d’interface
├── styles/         Styles globaux et styles propres aux modules
├── App.jsx         Composition de l’application
└── main.jsx        Point d’entrée React

electron/
├── main.cjs        Cycle de vie desktop et opérations système
├── preload.cjs     API sécurisée exposée à l’interface
└── database.cjs    Schéma, migrations et accès SQLite
```

## Modules métier

- `projects` : création des projets et formulaires transverses.
- `planning` : calendrier, Gantt, dépendances et charge.
- `agile` : Product Backlog, sprints, tableau Scrum et indicateurs.
- `procurement` : fournisseurs, consultations, offres, contrats, documents et évaluations.

## Flux de données

L’interface React appelle exclusivement l’API exposée par `preload.cjs`. Le processus principal Electron valide l’opération et délègue la persistance à SQLite. L’interface n’accède jamais directement au système de fichiers ou à la base de données.

## Stockage local

Chaque installation conserve ses projets dans `kavelyo.sqlite`, au sein du dossier de données utilisateur du système. Les documents fournisseurs sont copiés dans un coffre local distinct, organisé par projet et fournisseur.

## Distribution

- macOS Apple Silicon : image disque DMG.
- Windows x64 : installateur NSIS.

Les fichiers de travail générés pendant la compilation ne font pas partie des livrables distribués.
