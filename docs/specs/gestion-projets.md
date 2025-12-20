# Gestion des projets — Specs fonctionnelles

## User Stories

- US-PROJ-01 — En tant qu’utilisateur, je veux créer un projet (nom + couleur) afin de regrouper des conversations liées.
- US-PROJ-02 — En tant qu’utilisateur, je veux sélectionner un projet depuis la barre latérale afin d’accéder à un tableau de bord (instructions, fichiers, conversations).
- US-PROJ-03 — En tant qu’utilisateur, je veux renommer un projet afin de garder une organisation claire.
- US-PROJ-04 — En tant qu’utilisateur, je veux supprimer un projet afin de retirer un regroupement, sans supprimer les conversations.
- US-PROJ-05 — En tant qu’utilisateur, je veux définir des instructions au niveau projet afin qu’elles s’appliquent à toutes les conversations du projet (en plus du prompt global).
- US-PROJ-06 — En tant qu’utilisateur, je veux ajouter/supprimer des fichiers de référence au niveau projet afin qu’ils soient automatiquement disponibles dans toutes les conversations du projet.
- US-PROJ-07 — En tant qu’utilisateur, je veux démarrer une conversation depuis un projet afin que la conversation soit rattachée au bon projet.
- US-PROJ-08 — En tant qu’utilisateur, je veux déplacer une conversation vers/entre projets (ou la retirer de tout projet) afin de réorganiser mon historique.
- US-PROJ-09 — En tant qu’utilisateur, je veux consulter les conversations d’un projet triées par activité afin de retrouver rapidement la bonne conversation.
- US-PROJ-10 — En tant qu’utilisateur, je veux retrouver mes projets, leurs paramètres et les rattachements des conversations après rechargement.

## Critères d’acceptation (Gherkin)

```gherkin
# language: fr

Fonctionnalité: Création de projet
  Scénario: Créer un projet avec un nom et une couleur
    Étant donné que je suis sur l’interface de chat
    Quand j’ouvre le formulaire de création de projet
    Et que je saisis le nom "Projet Alpha"
    Et que je sélectionne une couleur de projet
    Et que je valide la création
    Alors le projet "Projet Alpha" apparaît dans la liste des projets
    Et le projet affiche la couleur sélectionnée
    Et le projet indique "0" conversation

  Scénario: Ne pas créer de projet sans nom
    Étant donné que le formulaire de création de projet est ouvert
    Quand je valide la création avec un nom vide
    Alors aucun nouveau projet n’est ajouté à la liste

  Scénario: Annuler la création de projet
    Étant donné que le formulaire de création de projet est ouvert
    Quand j’annule la création
    Alors le formulaire se ferme
    Et aucun nouveau projet n’est ajouté à la liste


Fonctionnalité: Accès à un projet et navigation
  Scénario: Ouvrir le tableau de bord d’un projet depuis la barre latérale
    Étant donné qu’au moins un projet existe
    Quand je sélectionne un projet dans la barre latérale
    Alors j’affiche le tableau de bord du projet sélectionné
    Et je vois le nom du projet et un indicateur de couleur
    Et je vois les sections "Instructions", "Fichiers de référence" et "Conversations"

  Scénario: Déplier/Replier un projet dans la barre latérale
    Étant donné qu’un projet existe
    Quand je déplie le projet dans la barre latérale
    Alors la liste des conversations du projet est affichée sous ce projet
    Quand je replie le projet
    Alors la liste des conversations du projet n’est plus affichée


Fonctionnalité: Renommage de projet
  Scénario: Renommer un projet
    Étant donné qu’un projet "Projet Alpha" existe
    Quand je lance l’action de renommage sur ce projet
    Et que je saisis le nouveau nom "Projet Beta"
    Et que je confirme le renommage
    Alors le projet s’affiche avec le nom "Projet Beta"
    Et le nom est conservé après rechargement de la page

  Scénario: Annuler un renommage
    Étant donné qu’un projet "Projet Alpha" existe
    Quand je lance l’action de renommage
    Et que je saisis le nom "Tmp"
    Et que j’annule le renommage
    Alors le projet conserve son nom initial "Projet Alpha"

  Scénario: Refuser un renommage vide
    Étant donné qu’un projet "Projet Alpha" existe
    Quand je lance l’action de renommage
    Et que je vide le champ du nom
    Et que je confirme le renommage
    Alors le projet conserve son nom initial "Projet Alpha"


Fonctionnalité: Suppression de projet
  Scénario: Supprimer un projet sans supprimer ses conversations
    Étant donné qu’un projet existe avec au moins une conversation rattachée
    Quand je supprime ce projet
    Alors le projet n’apparaît plus dans la liste des projets
    Et les conversations précédemment rattachées restent accessibles
    Et ces conversations ne sont plus rattachées à aucun projet

  Scénario: Les conversations deviennent "non catégorisées"
    Étant donné qu’un projet existe avec une conversation rattachée
    Quand je supprime ce projet
    Alors la conversation apparaît dans la section des conversations non rattachées à un projet


Fonctionnalité: Instructions de projet
  Scénario: Mettre à jour les instructions depuis le tableau de bord (autosave)
    Étant donné que je suis sur le tableau de bord d’un projet
    Quand je modifie le texte des instructions du projet
    Alors les changements sont enregistrés automatiquement après un court délai
    Et les instructions sont conservées après rechargement de la page

  Scénario: Mettre à jour les instructions via les paramètres du projet (save explicite)
    Étant donné que la fenêtre "Paramètres du projet" est ouverte
    Quand je modifie les instructions du projet
    Et que je clique sur "Save"
    Alors les instructions du projet sont mises à jour
    Et elles sont conservées après rechargement de la page

  Scénario: Application des instructions de projet aux conversations
    Étant donné qu’un projet contient des instructions
    Quand j’envoie un message dans une conversation rattachée à ce projet
    Alors les instructions du projet sont ajoutées au prompt système envoyé au modèle
    Et elles s’ajoutent au prompt global et au prompt spécifique de la conversation


Fonctionnalité: Fichiers de référence de projet
  Scénario: Ajouter des fichiers de référence depuis le tableau de bord
    Étant donné que je suis sur le tableau de bord d’un projet
    Quand j’ajoute un ou plusieurs fichiers de référence supportés (image, txt, md, csv, json, pdf) de taille <= 20MB
    Alors les fichiers apparaissent dans la liste des fichiers de référence du projet
    Et le compteur de fichiers du projet est mis à jour
    Et les fichiers sont conservés après rechargement de la page

  Scénario: Refuser un fichier de référence non supporté ou trop volumineux
    Étant donné que je suis sur le tableau de bord d’un projet
    Quand j’essaie d’ajouter un fichier dont le type n’est pas supporté ou dont la taille dépasse 20MB
    Alors le fichier n’est pas ajouté au projet
    Et un message d’erreur est affiché à l’utilisateur

  Scénario: Supprimer un fichier de référence depuis le tableau de bord (avec confirmation)
    Étant donné qu’un projet contient au moins un fichier de référence
    Quand je demande la suppression d’un fichier
    Et que je confirme la suppression
    Alors le fichier n’apparaît plus dans la liste
    Et il n’est plus conservé après rechargement de la page

  Scénario: Les fichiers de référence sont automatiquement joints aux conversations du projet
    Étant donné qu’un projet contient des fichiers de référence
    Quand j’envoie le premier message d’une conversation rattachée à ce projet
    Alors les fichiers de référence du projet sont envoyés au modèle en plus des pièces jointes du message


Fonctionnalité: Démarrer une conversation dans un projet
  Scénario: Démarrer une conversation depuis le tableau de bord du projet
    Étant donné que je suis sur le tableau de bord d’un projet
    Quand j’envoie un message
    Alors une nouvelle conversation est créée et rattachée à ce projet
    Et l’interface bascule sur la vue conversation
    Et la conversation apparaît dans les listes du projet (barre latérale + tableau de bord)

  Scénario: Démarrer une conversation via le bouton "nouvelle conversation" d’un projet (barre latérale)
    Étant donné qu’un projet existe dans la barre latérale
    Quand je clique sur l’action "nouvelle conversation" du projet
    Alors une nouvelle conversation est ouverte et rattachée à ce projet
    Quand j’envoie le premier message
    Alors la conversation est enregistrée et apparaît dans les listes du projet


Fonctionnalité: Déplacer une conversation vers/entre projets
  Scénario: Rattacher une conversation à un projet via le menu contextuel
    Étant donné qu’une conversation existe
    Quand j’ouvre le menu contextuel de la conversation
    Et que je choisis un projet cible
    Alors la conversation est rattachée au projet choisi
    Et elle apparaît sous ce projet dans la barre latérale
    Et le compteur de conversations du projet est mis à jour

  Scénario: Retirer une conversation de tout projet
    Étant donné qu’une conversation est rattachée à un projet
    Quand j’ouvre le menu contextuel de la conversation
    Et que je choisis l’option "None"
    Alors la conversation n’est plus rattachée à aucun projet
    Et elle apparaît dans la section des conversations non rattachées à un projet

  Scénario: Déplacer une conversation d’un projet à un autre
    Étant donné qu’une conversation est rattachée au projet "A"
    Quand je la déplace vers le projet "B" via le menu contextuel
    Alors la conversation n’apparaît plus dans le projet "A"
    Et elle apparaît dans le projet "B"


Fonctionnalité: Consulter les conversations d’un projet (tableau de bord)
  Scénario: Afficher la liste des conversations triée par dernière activité
    Étant donné qu’un projet contient plusieurs conversations
    Quand j’ouvre le tableau de bord du projet
    Alors les conversations sont affichées par date de dernière mise à jour décroissante

  Scénario: Ouvrir une conversation depuis le tableau de bord
    Étant donné que je suis sur le tableau de bord d’un projet
    Quand je sélectionne une conversation dans la liste
    Alors l’interface affiche la vue conversation de cette conversation


Fonctionnalité: Persistance locale et migration (compatibilité)
  Scénario: Retrouver projets et rattachements après rechargement
    Étant donné que j’ai des projets et des conversations rattachées
    Quand je recharge la page
    Alors je retrouve mes projets (nom, couleur, instructions, fichiers)
    Et les conversations restent rattachées aux mêmes projets

  Scénario: Migration des anciens "folders" vers les projets
    Étant donné qu’un stockage local contient des "folders" (legacy)
    Quand l’application accède pour la première fois à la liste des projets
    Alors les "folders" sont convertis en projets
    Et les conversations legacy sont migrées vers le champ `projectId`
```

