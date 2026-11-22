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

La table `subscriptions`, le catalogue d’offres, l’essai de 14 jours et les limites de projets sont prêts. L’écran **Espace & accès** affiche l’offre, les sièges, les projets consommés, l’échéance et l’historique des paiements.

Jalonis utilise un Checkout Flutterwave hébergé : les données de carte ne traversent jamais l’application. Créer dans Flutterwave les plans mensuels et annuels, puis conserver leurs identifiants. Commencer avec les clés de test.

Déployer les fonctions et définir les secrets uniquement dans Supabase :

```bash
supabase functions deploy create-billing-checkout
supabase functions deploy flutterwave-webhook --no-verify-jwt
supabase secrets set FLW_SECRET_KEY=FLWSECK_TEST_xxx
supabase secrets set FLW_WEBHOOK_HASH=une_valeur_longue_et_aleatoire
supabase secrets set FLW_PLAN_PERSONAL_PRO_MONTHLY=0000
supabase secrets set FLW_PLAN_PERSONAL_PRO_ANNUAL=0000
supabase secrets set FLW_PLAN_TEAM_MONTHLY=0000
supabase secrets set FLW_PLAN_TEAM_ANNUAL=0000
supabase secrets set FLW_PLAN_BUSINESS_MONTHLY=0000
supabase secrets set FLW_PLAN_BUSINESS_ANNUAL=0000
```

Dans Flutterwave, renseigner cette adresse de webhook :

```text
https://VOTRE-PROJET.supabase.co/functions/v1/flutterwave-webhook
```

La valeur **Secret Hash** saisie dans Flutterwave doit être strictement identique à `FLW_WEBHOOK_HASH`. Le webhook vérifie ensuite la transaction directement auprès de Flutterwave, compare la référence, le montant et la devise, puis active l’abonnement. Un simple retour du navigateur ne peut donc pas débloquer une offre payante.

## 6. Invitations et notifications

La fonction `invite-member` vérifie le rôle de l’expéditeur, la limite de places, crée l’invitation puis déclenche l’e-mail sécurisé de Supabase. Le lien rattache le nouveau compte à l’organisation et lui demande de choisir son mot de passe.

Les autres e-mails passent par une file sécurisée : affectations, changements de statut, tâches terminées, commentaires, mentions et résumé quotidien. Les préférences et heures silencieuses du membre sont respectées, et une clé d’idempotence empêche les envois en double.

Créer un compte Resend, vérifier le domaine d’envoi, puis configurer :

```bash
supabase functions deploy process-email-queue --no-verify-jwt
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set JALONIS_EMAIL_FROM="Jalonis <notifications@votre-domaine.com>"
supabase secrets set JALONIS_CRON_SECRET=une_autre_valeur_longue_et_aleatoire
```

Dans **Supabase → Integrations → Cron**, créer un appel HTTP toutes les heures vers :

```text
https://VOTRE-PROJET.supabase.co/functions/v1/process-email-queue
```

Ajouter l’en-tête `x-jalonis-cron-secret` avec la même valeur que `JALONIS_CRON_SECRET`. Une exécution horaire permet de respecter l’heure locale de chaque utilisateur. La fonction traite au maximum 50 messages par passage et reporte automatiquement un échec temporaire.

### Rappels WhatsApp

Jalonis utilise l’API WhatsApp Cloud de Meta et uniquement des modèles approuvés. Aucun message n’est préparé tant que le membre n’a pas renseigné son numéro et activé lui-même WhatsApp dans **Espace de travail → Mes notifications**.

Créer l’application Meta Business, rattacher le numéro WhatsApp Business, puis déployer et configurer les deux fonctions :

```bash
supabase functions deploy process-whatsapp-queue --no-verify-jwt
supabase functions deploy whatsapp-webhook --no-verify-jwt
supabase secrets set WHATSAPP_ACCESS_TOKEN=EA...
supabase secrets set WHATSAPP_PHONE_NUMBER_ID=000000000000000
supabase secrets set WHATSAPP_VERIFY_TOKEN=une_valeur_longue_et_aleatoire
supabase secrets set WHATSAPP_APP_SECRET=le_secret_de_l_application_meta
supabase secrets set WHATSAPP_TEMPLATE_LANGUAGE=fr
supabase secrets set SITE_URL=https://votre-domaine.com
```

Créer et faire approuver deux modèles utilitaires dans WhatsApp Manager :

- `jalonis_project_alert` : titre `{{1}}`, puis détail `{{2}}` ;
- `jalonis_daily_summary` : prénom `{{1}}`, tâches `{{2}}`, réunions `{{3}}`, risques critiques `{{4}}` et adresse Jalonis `{{5}}`.

Dans la configuration des webhooks Meta, utiliser :

```text
https://VOTRE-PROJET.supabase.co/functions/v1/whatsapp-webhook
```

Le jeton de vérification doit être identique à `WHATSAPP_VERIFY_TOKEN`. S’abonner au champ `messages` permet ensuite de mettre à jour les états envoyé, livré, lu ou échoué.

Créer enfin un second appel HTTP horaire dans **Supabase → Integrations → Cron** vers :

```text
https://VOTRE-PROJET.supabase.co/functions/v1/process-whatsapp-queue
```

Ajouter l’en-tête `x-jalonis-cron-secret` déjà utilisé pour les e-mails. La fonction respecte les préférences, les heures silencieuses et le fuseau horaire, déduplique les rappels et retente les échecs temporaires. Sans ces clés Meta, le canal reste inactif et n’empêche pas le reste de Jalonis de fonctionner.

## 7. Assistant de pilotage

L’écran **Assistant** comporte deux niveaux :

- une analyse locale disponible sans service externe, calculée à partir des retards, blocages, risques, responsables et coûts ;
- une analyse approfondie réservée à l’offre Business, exécutée par une fonction serveur et limitée par un quota mensuel.

La clé du fournisseur d’IA reste exclusivement dans les secrets Supabase. Elle ne doit jamais être copiée dans Render, dans le navigateur ou dans le dépôt GitHub.

```bash
supabase functions deploy project-assistant --no-verify-jwt
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set OPENAI_ASSISTANT_MODEL=gpt-5-mini
```

Le modèle peut être remplacé par un modèle disponible dans le compte utilisé. Lorsqu’un chef de projet demande une analyse, Jalonis envoie uniquement un contexte structuré du projet : charte, dates, tâches ou backlog, risques, réunions, problèmes, décisions et données de coûts. Les commentaires libres, coordonnées des membres et documents joints ne sont pas envoyés. La requête utilise `store: false` et la réponse est enregistrée dans l’espace Jalonis pour conserver une trace des analyses réalisées.

L’offre Business autorise actuellement 100 analyses approfondies par espace et par mois. L’édition Entreprise utilise un quota contractuel. Les recommandations restent indicatives et doivent être validées par le chef de projet.
