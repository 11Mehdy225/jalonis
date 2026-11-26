# Politique de sécurité de l'information - Kavelyo

**Éditeur :** RONNA GROUP SARLU  
**Version :** 1.0  
**Date d'effet :** 24 novembre 2026  
**Responsable :** Konan Ndassenan Loïc Harold Mehdy, Directeur Général  
**Contact :** contact@ronnagroup.net

## 1. Objet et périmètre

La présente politique définit les mesures appliquées à Kavelyo pour protéger les comptes, espaces de travail, projets, fichiers, données de collaboration, informations fournisseurs, références de paiement et journaux techniques. Elle couvre l'application Web, les applications Desktop connectées, l'infrastructure Supabase, les fonctions serveur et les services techniques nécessaires.

## 2. Principes

- moindre privilège et séparation des rôles ;
- isolation des données par organisation et par projet ;
- authentification obligatoire pour les espaces connectés ;
- protection des secrets techniques et des données de paiement ;
- traçabilité des actions sensibles ;
- chiffrement des communications et des sauvegardes exportées ;
- correction proportionnée au risque et amélioration continue.

## 3. Identités et accès

Les utilisateurs disposent d'un compte individuel. Les rôles Propriétaire, Administrateur, Chef de projet, Scrum Master, Product Owner, Membre, Observateur et Fournisseur externe limitent les opérations autorisées. Les contrôles sont appliqués côté serveur et en base de données, et non uniquement dans l'interface. Les invitations sont limitées dans le temps et les comptes inactifs doivent être désactivés.

Les accès d'administration de la plateforme sont réservés aux personnes expressément habilitées par RONNA GROUP. Les comptes privilégiés ne doivent pas être partagés. Les secrets, clés privées et jetons d'administration ne doivent jamais être placés dans le code public, les captures d'écran, les tickets ou les messages ordinaires.

## 4. Protection des données

Les échanges avec les services cloud utilisent HTTPS/TLS. Les données cloud sont protégées par les mécanismes de sécurité de Supabase et par des politiques de sécurité ligne par ligne. Les fichiers sont rangés dans des espaces contrôlés par l'appartenance à une organisation. Les sauvegardes de projet exportées depuis Kavelyo peuvent être chiffrées en AES-256-GCM à partir d'un mot de passe d'au moins douze caractères.

Kavelyo ne stocke pas les mots de passe en clair, les codes secrets de portefeuille mobile, les codes OTP ni les numéros complets de carte bancaire. Les paiements sont confirmés au moyen de références et d'événements transmis par le prestataire autorisé.

## 5. Développement et changements

Chaque modification importante fait l'objet de contrôles automatisés adaptés : construction de l'application, contrôles des migrations, permissions, collaboration, abonnements, paiements, sauvegardes et supervision. Les changements sont versionnés dans le dépôt de code. Les dépendances et alertes de sécurité doivent être examinées régulièrement ; une correction critique est prioritaire sur une évolution fonctionnelle.

Les environnements de développement et de production sont séparés autant que possible. Les données réelles ne doivent pas être copiées dans un environnement de test sans nécessité, autorisation et mesures de protection appropriées.

## 6. Journalisation et supervision

Kavelyo journalise les événements nécessaires à la sécurité, aux opérations sensibles, aux paiements et à l'administration. La supervision de la plateforme regroupe les erreurs, signaux de sécurité et incidents sans enregistrer volontairement le contenu complet des projets. L'accès à ces informations est réservé aux administrateurs de plateforme habilités.

Les appels sensibles sont soumis à des limites de fréquence côté serveur. Les journaux et données de télémétrie sont conservés conformément à la politique de conservation et supprimés ou agrégés lorsqu'ils ne sont plus nécessaires.

## 7. Sauvegarde et continuité

Les mécanismes de sauvegarde des prestataires cloud sont complétés par l'export chiffré des projets. Les restaurations importantes doivent être testées périodiquement. Les propriétaires de projets Desktop en mode local restent responsables de la conservation de leurs sauvegardes et de leur mot de passe de chiffrement.

En cas d'indisponibilité, les fonctions prioritaires sont l'authentification, l'accès aux données existantes, la collaboration et le rétablissement des paiements. Toute restauration doit préserver l'isolation entre organisations.

## 8. Sous-traitants

Les principaux services techniques sont Supabase pour l'authentification, la base et le stockage, Render pour l'hébergement Web, Resend pour les e-mails et Jèko pour les paiements. Leur accès est limité aux opérations nécessaires au service. Leurs conditions de sécurité, lieux de traitement et sous-traitants ultérieurs doivent être revus avant toute modification substantielle.

## 9. Incidents

Tout événement susceptible d'affecter la confidentialité, l'intégrité ou la disponibilité est enregistré, qualifié et traité selon la procédure de gestion des incidents. Les accès compromis sont révoqués rapidement. Lorsque des données personnelles sont concernées, RONNA GROUP évalue les obligations d'information de l'ARTCI, des clients et des personnes concernées.

## 10. Sensibilisation et révision

Les personnes habilitées doivent être sensibilisées aux mots de passe, à l'hameçonnage, aux données personnelles, aux secrets techniques et au signalement des incidents. Une formation ARTCI ou dispensée par un cabinet agréé sera enregistrée dans le dossier de conformité dès sa réalisation.

La politique est revue au moins une fois par an et après tout incident majeur, changement de prestataire ou évolution importante de l'architecture.

