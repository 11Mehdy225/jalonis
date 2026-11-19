# Collaboration Jalonis

## Version 0.3 — fondation locale

Cette version introduit la structure nécessaire au futur mode équipe :

- un espace de travail pour regrouper les projets ;
- des comptes membres distincts des anciennes fiches d’équipe projet ;
- les rôles Propriétaire, Administrateur, Chef de projet, Scrum Master, Product Owner, Membre, Observateur et Fournisseur externe ;
- les états Actif et Invitation en attente ;
- les préférences de rappel par e-mail et WhatsApp ;
- l’affectation d’une tâche à un compte membre.

Les données restent stockées sur l’ordinateur. Créer une invitation prépare le compte, mais n’envoie pas encore d’e-mail.

## Prochaine étape — mode équipe connecté

Le même modèle sera porté sur un serveur PostgreSQL avec authentification et contrôle des accès. L’application web et l’application installable utiliseront alors la même interface et le même service de données.

Ordre de réalisation :

1. authentification et invitations réelles ;
2. isolation des données par espace de travail ;
3. projets et affectations partagés ;
4. commentaires, mentions et historique ;
5. notifications par e-mail ;
6. Daily Scrum et synthèses ;
7. rappels WhatsApp avec consentement ;
8. assistance intelligente et détection des risques.

## Principes de sécurité

- chaque requête devra être rattachée à un utilisateur et à un espace autorisé ;
- les droits seront vérifiés sur le serveur et pas seulement dans l’interface ;
- les actions sensibles seront conservées dans un journal d’audit ;
- les numéros WhatsApp et préférences de notification resteront facultatifs ;
- aucune notification WhatsApp ne sera envoyée sans consentement explicite.
