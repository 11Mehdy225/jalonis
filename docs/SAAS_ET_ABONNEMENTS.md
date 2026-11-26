# Kavelyo SaaS — comptes et abonnements

## Échéance et protection des données

- L’offre Découverte est gratuite et n’expire pas.
- Les offres payantes déclenchent des rappels avant l’échéance (J-7, J-3 et le jour même).
- Un délai de grâce de trois jours maintient toutes les fonctions actives après l’échéance.
- Après ce délai, l’espace passe en lecture seule : consultation et export restent possibles, mais les créations, modifications, suppressions, invitations et téléversements sont bloqués côté serveur.
- Le paiement confirmé par Jèko ou la réactivation par l’administration rend immédiatement les écritures possibles, sans perte de données.

## Positionnement

Kavelyo conservera une seule expérience produit sur trois canaux :

- application web collaborative ;
- application Desktop macOS et Windows connectée au même compte ;
- édition privée pour les entreprises qui souhaitent un hébergement dédié.

La version Desktop ne sera pas supprimée. En mode Personnel local, elle pourra continuer à fonctionner sans serveur. En mode connecté, elle utilisera les mêmes espaces, projets et droits que la version web.

## Types de comptes

### Compte Personnel

Destiné à un chef de projet, consultant, étudiant ou indépendant. Un utilisateur peut gérer ses propres projets et rejoindre des organisations auxquelles il est invité.

### Compte Organisation

Destiné à une entreprise, une administration ou une association. L’organisation possède ses espaces, ses projets, sa facturation et ses règles d’accès. Elle invite ses employés et peut leur attribuer des rôles différents selon les projets.

Un même utilisateur conserve un seul identifiant et peut appartenir à plusieurs organisations.

## Modèle de facturation proposé

Ces tarifs constituent la grille de lancement en francs CFA. L’abonnement annuel correspond à dix mois facturés, soit deux mois offerts.

| Offre | Prix mensuel | Prix annuel | Utilisateurs | Cible |
|---|---:|---:|---:|---|
| Découverte | Gratuit | Gratuit | 1 | Découverte, deux projets personnels |
| Personnel Pro | 5 000 FCFA | 50 000 FCFA | 1 | Chef de projet indépendant |
| Équipe | 6 000 FCFA par membre actif | 60 000 FCFA par membre | 3 minimum | PME et équipes projet |
| Business | 9 000 FCFA par membre actif | 90 000 FCFA par membre | 10 minimum | Organisations avec automatisations et assistance intelligente |
| Entreprise | Sur devis | Sur devis | Selon contrat | Hébergement dédié, SSO, sauvegardes et accompagnement |

Les observateurs en lecture seule et les fournisseurs externes ne consomment pas de siège payant. Les coûts variables de WhatsApp et certains usages intensifs d’assistance intelligente restent encadrés par les quotas de l’offre.

## Comptage des abonnements

- un siège payant correspond à un membre actif pouvant créer ou modifier des données ;
- un membre désactivé ne consomme plus de siège au cycle suivant ;
- une invitation non acceptée ne consomme pas de siège ;
- le propriétaire de l’organisation consomme un siège actif ;
- les fournisseurs externes et observateurs disposent de droits limités ;
- la facturation mensuelle est calculée sur le nombre maximal de sièges actifs du cycle ;
- la facturation annuelle repose sur un nombre de sièges réservés.

## Fonctions par niveau

### Découverte

- application Desktop locale ;
- projets et stockage limités ;
- planning, Scrum, risques et fournisseurs ;
- aucun travail simultané.

### Personnel Pro

- synchronisation web et Desktop ;
- projets personnels illimités selon les limites raisonnables d’usage ;
- exports, modèles et sauvegardes ;
- rappels par e-mail.

### Équipe

- organisation et invitations ;
- rôles et permissions ;
- Scrum collaboratif en temps réel ;
- commentaires, mentions et historique ;
- rapports d’équipe et Daily Scrum ;
- stockage partagé.

### Business

- portefeuilles multi-projets ;
- automatisations avancées ;
- assistance intelligente, synthèses et détection des risques ;
- intégrations et webhooks ;
- journal d’audit, politiques de sécurité et support prioritaire.

### Entreprise privée

- hébergement dédié ou installation privée ;
- authentification d’entreprise et gestion centralisée des identités ;
- engagements de service, sauvegardes et accompagnement à la migration ;
- conditions contractuelles adaptées.

## Architecture de facturation

La base centrale devra contenir les organisations, abonnements, produits, prix, sièges, périodes de facturation, factures et événements de paiement. Un prestataire de paiement gérera les cartes et les renouvellements. Kavelyo ne stockera jamais directement les numéros de carte.

Les droits fonctionnels seront calculés côté serveur à partir de l’offre active. L’interface ne pourra pas, à elle seule, accorder un accès payant.

## Étapes de livraison

1. comptes connectés et authentification ;
2. organisations, sélection multi-espace, invitations et rôles — intégrés ;
3. base PostgreSQL et synchronisation web/Desktop — connecteurs et schéma intégrés, activation avec les clés Supabase ;
4. collaboration en temps réel — diffusion de tous les registres intégrée ;
5. essais gratuits, plans et limites ;
6. paiement et portail de facturation — socle Flutterwave intégré, activation en attente des clés ;
7. e-mails transactionnels — file, préférences, résumé quotidien et anti-doublon intégrés ;
8. rappels WhatsApp — consentement, file d’envoi, résumé quotidien et suivi de livraison intégrés ;
9. assistance intelligente — signaux explicables, priorités locales, analyse serveur auditée et quota Business intégrés ;
10. édition Entreprise privée.
