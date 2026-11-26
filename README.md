# Kavelyo

Application macOS et Windows locale de pilotage de projet, pensée pour relier les dimensions techniques, financières et humaines du cycle de vie d’un projet.

Kavelyo est conçu et édité par **Ronna Group**. Copyright © 2026 Ronna Group. Tous droits réservés.

La version 0.17 prépare la cible SaaS complète : authentification Supabase, récupération de mot de passe, espaces Personnel ou Organisation, collaboration en temps réel, base PostgreSQL isolée par organisation, stockage sécurisé, abonnements et interface commune avec les applications Desktop.

## Version web

Prérequis : Node.js 24 et un projet Supabase.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Renseignez `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans `.env.local`, puis appliquez la migration située dans `supabase/migrations/` depuis le tableau de bord SQL Supabase ou la CLI Supabase.

La construction de production est interrompue si les variables Supabase sont absentes, afin de ne jamais publier par erreur une page de connexion inactive. Le mode aperçu reste accessible sur le site correctement configuré et n’envoie aucune donnée vers Supabase.

Pour produire les fichiers web :

```bash
npm run build:web
```

Le dossier `dist/` peut être déployé sur Vercel ou Netlify. Les fichiers de configuration nécessaires sont inclus.

## Démarrage sur Mac

Prérequis : Node.js 24 ou plus récent.

```bash
npm install
npm run dev
```

Au premier lancement, Kavelyo crée automatiquement une base SQLite locale vide dans le dossier de données de l’application macOS. L’écran d’accueil permet de créer directement votre premier projet réel.

## Générer l’application installable

```bash
npm run build
```

Le fichier `.dmg` sera créé dans `release/`. La version n’est pas encore signée ni notarialisée par Apple.

Pour créer l’installateur Windows 64 bits :

```bash
npm run build:win
```

Le fichier d’installation `.exe` sera créé dans `release/`. Les versions de test ne sont pas encore signées numériquement.

## Fonctionnalités du MVP

- Portefeuille de plusieurs projets
- Tableau de bord et santé du projet
- Charte de projet
- Activités, échéances, responsables et avancement
- Vue calendrier mensuelle avec bandes colorées pour les activités sur plusieurs jours
- WBS, jalons et dépendances FS/SS/FF/SF avec avance ou retard
- Diagramme de Gantt, chemin critique et baseline prévue
- Dates réelles, travail estimé et détection des surcharges de ressources
- Relations directes entre activités, risques et réunions
- Modes de projet Prédictif, Scrum et Hybride
- Product Goal, Definition of Done, Product Backlog et Sprint Backlog
- Epics, User Stories, bugs, Story Points et critères d’acceptation
- Tableau Scrum par glisser-déposer, Sprint Goal, burndown et vélocité
- Liaison des éléments Scrum aux activités WBS du planning directeur
- Registre des fournisseurs avec qualification, risque, contacts et conditions de paiement
- Consultations RFI, RFQ, RFP, appels d’offres et source unique liées aux activités WBS et risques
- Réception et comparaison pondérée des offres techniques et financières
- Contrats, livrables, renouvellements et alertes d’échéance
- Dossier documentaire fournisseur avec pièces jointes locales et dates d’expiration
- Évaluation de la performance fournisseur sur cinq dimensions
- Registre des risques avec score probabilité × impact
- Équipe, rôles, compétences et disponibilités
- Réunions, décisions et actions
- Rapports imprimables, exports CSV et sauvegardes projet chiffrées par mot de passe
- Stockage SQLite local et hors ligne

## Arborescence

```text
Kavelyo/
├── build/                Icônes et ressources de distribution
├── docs/                 Documentation produit et guide utilisateur
├── electron/             Processus desktop, sécurité IPC et SQLite
│   ├── database.cjs
│   ├── main.cjs
│   └── preload.cjs
├── public/assets/        Ressources visuelles utilisées par l’interface
├── scripts/              Outils internes de génération documentaire
├── src/
│   ├── features/         Modules métier organisés par domaine
│   │   ├── agile/
│   │   ├── planning/
│   │   ├── procurement/
│   │   └── projects/
│   ├── services/         Accès à l’API desktop
│   ├── shared/           Composants d’interface réutilisables
│   ├── styles/           Feuilles de style par module
│   ├── App.jsx           Interface et modules du MVP
│   └── main.jsx
├── release/              Installateurs macOS et Windows
├── index.html
├── package.json
└── vite.config.js
```

## Prochaines étapes

Les prochaines versions intégreront les sous-tâches repliables, les calendriers ouvrés, le nivellement automatique, les coûts réels et l’EVM, la matrice RACI, les bons de commande détaillés, le suivi des factures et paiements, les changements, les champs personnalisés, les sauvegardes exportables et les rapports PDF/Excel.
