# Démarrage de Jalonis SaaS

## 1. Créer l’infrastructure

Créer un projet Supabase dans la région la plus proche des futurs clients. Conserver la clé `service_role` uniquement dans les fonctions serveur. Le navigateur utilise exclusivement la clé publique `anon`.

Dans l’éditeur SQL Supabase, appliquer dans l’ordre tous les fichiers du dossier `supabase/migrations`.

Cette migration crée :

- les profils utilisateurs ;
- les espaces Personnel et Organisation ;
- les membres, rôles et invitations ;
- les abonnements et le catalogue d’offres ;
- les projets et tous les objets PMP, Scrum et fournisseurs ;
- les commentaires, Daily Scrum et journaux d’audit ;
- les politiques de sécurité ligne par ligne ;
- le stockage privé `workspace-files`.

## 2. Configurer l’application web

Copier `.env.example` vers `.env.local`, puis renseigner :

```text
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxxxxx
```

Ne jamais placer la clé `service_role`, un secret de paiement ou un mot de passe dans un fichier commité sur GitHub.

## 3. Lancer et vérifier

```bash
npm install
npm run dev
```

Créer un compte de validation, confirmer l’adresse e-mail, puis vérifier :

1. la création automatique de l’espace personnel ou de l’organisation ;
2. la création d’un projet ;
3. l’isolation avec un second compte ;
4. l’invitation d’un membre ;
5. l’ajout et l’ouverture d’un document fournisseur ;
6. l’accès depuis le web et l’application Desktop connectée.

## 4. Déployer

Vercel et Netlify sont préconfigurés. Dans l’hébergeur choisi, ajouter les deux variables `VITE_SUPABASE_*`, puis déployer la branche `main`.

Ajouter l’URL publique dans Supabase : Authentication → URL Configuration → Site URL et Redirect URLs.

Déployer ensuite la fonction d’invitation et définir l’URL publique utilisée dans les e-mails :

```bash
supabase functions deploy invite-member
supabase secrets set SITE_URL=https://jalonis.onrender.com
```

La clé `SUPABASE_SERVICE_ROLE_KEY` est fournie automatiquement aux fonctions Supabase hébergées. Elle ne doit jamais être ajoutée aux variables Render ni au code de l’application.

## 5. Activer la facturation

La table `subscriptions` est prête, mais aucun paiement réel n’est encore déclenché. La prochaine étape consiste à connecter un prestataire de paiement au moyen de fonctions serveur et de webhooks signés. Les droits ne doivent être activés qu’après vérification serveur de l’événement de paiement.

## 6. Invitations et notifications

La fonction `invite-member` vérifie le rôle de l’expéditeur, la limite de places, crée l’invitation puis déclenche l’e-mail sécurisé de Supabase. Le lien rattache le nouveau compte à l’organisation et lui demande de choisir son mot de passe. Le même principe serveur s’appliquera ultérieurement à WhatsApp et aux rappels automatiques.
