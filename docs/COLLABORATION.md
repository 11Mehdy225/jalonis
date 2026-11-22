# Collaboration Jalonis

## Version 0.17 — collaboration locale et cloud

Cette version introduit la structure nécessaire au futur mode équipe :

- un espace de travail pour regrouper les projets ;
- des comptes membres distincts des anciennes fiches d’équipe projet ;
- les rôles Propriétaire, Administrateur, Chef de projet, Scrum Master, Product Owner, Membre, Observateur et Fournisseur externe ;
- les états Actif et Invitation en attente ;
- les préférences de rappel par e-mail et WhatsApp ;
- l’affectation d’une tâche à un compte membre.
- plusieurs espaces isolés, avec changement d’organisation depuis l’application.

En mode Desktop local, les données restent stockées sur l’ordinateur et une invitation prépare le compte sans envoyer d’e-mail. En mode SaaS, Supabase isole chaque espace, envoie les invitations et synchronise tous les registres du projet en temps réel.

## Activation du mode équipe connecté

Le modèle PostgreSQL, l’authentification et les contrôles d’accès sont prêts. L’activation consiste à appliquer les migrations, renseigner les deux variables publiques Supabase et déployer les fonctions décrites dans `DEMARRAGE_SAAS.md`.

Ordre de réalisation :

1. authentification et invitations réelles ;
2. isolation des données par espace de travail — sélection multiple intégrée ;
3. projets et affectations partagés ;
4. commentaires, mentions et historique ;
5. notifications par e-mail ;
6. Daily Scrum et synthèses ;
7. rappels WhatsApp avec consentement ;
8. assistance intelligente et détection des risques — signaux locaux explicables et analyse serveur intégrés.

## Principes de sécurité

- chaque requête devra être rattachée à un utilisateur et à un espace autorisé ;
- les droits seront vérifiés sur le serveur et pas seulement dans l’interface ;
- les actions sensibles seront conservées dans un journal d’audit ;
- les numéros WhatsApp et préférences de notification resteront facultatifs ;
- aucune notification WhatsApp ne sera envoyée sans consentement explicite.
