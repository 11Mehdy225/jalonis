# Mise en production de Kavelyo

## Adresses publiques

- Application actuelle : `https://kavelyo.ronnagroup.net`
- Domaine conseillé : `app.kavelyo.com` ou un sous-domaine appartenant à l’entreprise
- Assistance : variable Render `VITE_SUPPORT_EMAIL` (valeur actuelle par défaut : `contact@ronnagroup.net`)

Après ajout du domaine dans Render, ajouter exactement les mêmes adresses dans Supabase, rubrique **Authentication > URL Configuration** :

- Site URL : l’adresse principale en HTTPS ;
- Redirect URLs : l’adresse principale, l’adresse Render et leurs variantes avec `/**` ;
- ne jamais ajouter de clé privée dans Render ou dans le dépôt Git.

## E-mails Kavelyo

La file d’envoi et le résumé quotidien sont déjà intégrés. Pour les activer :

1. vérifier un domaine d’envoi auprès de Resend ;
2. créer une clé Resend limitée à l’envoi ;
3. ajouter dans les secrets Supabase `RESEND_API_KEY`, `KAVELYO_EMAIL_FROM` et `KAVELYO_CRON_SECRET` ;
4. planifier un appel toutes les cinq minutes vers `process-email-queue` avec l’en-tête `x-kavelyo-cron-secret` ;
5. dans la console **Administration SaaS**, marquer le canal E-mail comme configuré puis l’activer ;
6. configurer le SMTP personnalisé Supabase avec le même domaine afin que les confirmations et réinitialisations portent aussi l’identité Kavelyo.

Les modèles prêts à synchroniser avec **Authentication > Email Templates** se trouvent dans `supabase/templates` : confirmation, invitation, récupération du mot de passe, lien magique et changement d’adresse.

Le résumé quotidien respecte le fuseau horaire, l’heure de fin de silence et les préférences de chaque membre.

## WhatsApp

Le code de file, de consentement, de webhook et de traitement est prêt. L’activation reste facultative et nécessite les identifiants Meta Cloud API. Aucun numéro ne doit recevoir de message sans consentement explicite dans **Espace & accès**.

## Paiements

- Le paiement par dépôt et la validation manuelle sont disponibles depuis l’administration.
- Jèko reste désactivé tant que ses identifiants et prix définitifs ne sont pas fournis.
- Un administrateur peut activer, suspendre, réactiver ou prolonger un abonnement sans dépendre du prestataire de paiement.

## Applications Desktop

Les applications macOS et Windows proposent deux modes :

- **Kavelyo Cloud** : le même compte, les mêmes espaces et les mêmes données que le web ;
- **Stockage local** : base SQLite propre à l’ordinateur, utilisable hors ligne.

Les installateurs sont produits avec `npm run build:mac` et `npm run build:win`. Une version publique devra ensuite être signée : certificat Apple Developer ID et notarisation pour macOS, certificat de signature de code pour Windows.

État actuel : les installateurs de test macOS Apple Silicon, macOS Intel et Windows x64 sont générés. Ils utilisent le même backend Supabase en mode Cloud. La distribution publique reste conditionnée par les certificats de signature Apple et Windows.

## Référencement public

La version web publie les métadonnées sociales, l’adresse canonique `kavelyo.ronnagroup.net`, des données structurées `SoftwareApplication`, un fichier `robots.txt` et un sitemap incluant l’accueil, les tarifs, le support et les pages juridiques. Déclarer maintenant ce domaine et son sitemap dans Google Search Console et Bing Webmaster Tools.

## Codes promotionnels

Les administrateurs SaaS peuvent créer un code en choisissant l’offre, la durée, le nombre maximal d’utilisations et la date limite de validation. La période commence au premier jour de validation par l’espace. Un seul avantage promotionnel est autorisé par espace. À l’échéance, l’espace passe en lecture seule et propose les offres payantes, sans supprimer les données.

## Contrôle avant publication

Exécuter `npm test`, `npm run test:release`, `npm run build:web`, puis les contrôles en direct de collaboration et de production. Vérifier ensuite manuellement sur iPhone, iPad, navigateur Desktop, macOS et Windows : création de compte, invitation, rôles, fichiers, Scrum, planning, fournisseurs, exports et abonnement.
