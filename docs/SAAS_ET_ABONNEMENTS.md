# Jalonis SaaS — comptes et abonnements

## Positionnement

Jalonis conservera une seule expérience produit sur trois canaux :

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

Ces tarifs sont une hypothèse de lancement à tester commercialement avant publication.

| Offre | Prix mensuel indicatif | Utilisateurs | Cible |
|---|---:|---:|---|
| Découverte | Gratuit | 1 | Découverte, projets personnels limités |
| Personnel Pro | 4,90 € | 1 | Chef de projet indépendant |
| Équipe | 5,90 € par utilisateur actif | 3 minimum | PME et équipes projet |
| Business | 9,90 € par utilisateur actif | 10 minimum | Organisations avec automatisations et assistance intelligente |
| Entreprise privée | Sur devis | Selon contrat | Hébergement dédié, SSO, sauvegardes et accompagnement |

Une réduction de 15 % pourra être proposée pour un paiement annuel. Les observateurs en lecture seule pourront être gratuits ou facturés à un tarif réduit. Les coûts variables de WhatsApp et certains usages intensifs d’assistance intelligente devront être inclus dans un quota ou facturés séparément.

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

La base centrale devra contenir les organisations, abonnements, produits, prix, sièges, périodes de facturation, factures et événements de paiement. Un prestataire de paiement gérera les cartes et les renouvellements. Jalonis ne stockera jamais directement les numéros de carte.

Les droits fonctionnels seront calculés côté serveur à partir de l’offre active. L’interface ne pourra pas, à elle seule, accorder un accès payant.

## Étapes de livraison

1. comptes connectés et authentification ;
2. organisations, invitations et rôles ;
3. base PostgreSQL et synchronisation web/Desktop ;
4. collaboration en temps réel ;
5. essais gratuits, plans et limites ;
6. paiement et portail de facturation ;
7. e-mails transactionnels ;
8. WhatsApp et assistance intelligente ;
9. édition Entreprise privée.
