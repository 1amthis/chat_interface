# MCP Apps — User Stories et Critères d'acceptation

## User Stories

### Intégration MCP Apps

- **US-MCP-01** — En tant qu'utilisateur, je veux me connecter à des serveurs MCP afin d'accéder à des ressources et interfaces utilisateur externes.
- **US-MCP-02** — En tant qu'utilisateur, je veux voir la liste des ressources UI pré-déclarées (ui://) disponibles sur mes serveurs MCP afin de savoir ce qui est accessible.
- **US-MCP-03** — En tant qu'utilisateur, je veux prévisualiser une ressource MCP App dans le panneau d'artifact afin de voir son interface utilisateur.
- **US-MCP-04** — En tant qu'utilisateur, je veux que les MCP Apps s'exécutent dans un environnement isolé afin de garantir la sécurité de mes données.
- **US-MCP-05** — En tant qu'utilisateur, je veux voir quand un outil MCP a une interface UI associée afin de bénéficier d'une expérience enrichie.
- **US-MCP-06** — En tant qu'utilisateur, je veux que les MCP Apps communiquent avec leur serveur via JSON-RPC afin qu'elles puissent récupérer des données dynamiques.
- **US-MCP-07** — En tant qu'utilisateur, je veux être notifié quand une MCP App tente d'invoquer un outil afin de garder le contrôle sur les actions effectuées.
- **US-MCP-08** — En tant qu'utilisateur, je veux inspecter le code HTML d'une MCP App avant son exécution afin de vérifier son contenu.
- **US-MCP-09** — En tant qu'utilisateur, je veux que les MCP Apps fonctionnent avec des fallbacks texte afin de maintenir la compatibilité avec tous les assistants.
- **US-MCP-10** — En tant qu'utilisateur, je veux gérer mes connexions aux serveurs MCP (ajouter/supprimer/configurer) afin de contrôler mes intégrations.

---

## Critères d'acceptation (Gherkin)

```gherkin
# language: fr

Fonctionnalité: Intégration MCP Apps — Connexion et gestion des serveurs
  Scénario: Connexion à un serveur MCP
    Étant donné que je configure un nouveau serveur MCP dans les paramètres
    Et que je fournis l'URL ou le chemin du serveur
    Quand je clique sur "Connecter"
    Alors une connexion JSON-RPC est établie avec le serveur
    Et le statut du serveur passe à "Connecté"

  Scénario: Lister les serveurs MCP connectés
    Étant donné que j'ai 2 serveurs MCP connectés
    Quand j'ouvre la section "Serveurs MCP" dans les paramètres
    Alors je vois la liste des 2 serveurs
    Et chaque serveur affiche son nom et son statut de connexion

  Scénario: Déconnexion d'un serveur MCP
    Étant donné qu'un serveur MCP est connecté
    Quand je clique sur "Déconnecter" pour ce serveur
    Alors la connexion est fermée proprement
    Et le statut passe à "Déconnecté"
    Et les ressources de ce serveur ne sont plus accessibles

  Scénario: Gérer l'échec de connexion à un serveur MCP
    Étant donné que je tente de me connecter à un serveur MCP invalide ou inaccessible
    Quand la tentative de connexion échoue
    Alors un message d'erreur explicite est affiché
    Et le serveur n'est pas ajouté à la liste des serveurs actifs


Fonctionnalité: MCP Apps — Ressources UI pré-déclarées (ui://)
  Scénario: Récupérer les ressources UI d'un serveur MCP
    Étant donné qu'un serveur MCP est connecté
    Et que le serveur expose 3 ressources avec le schéma "ui://"
    Quand la connexion est établie
    Alors les 3 ressources UI sont récupérées et enregistrées
    Et chaque ressource contient un URI, un nom, et un type MIME

  Scénario: Afficher la liste des ressources UI disponibles
    Étant donné que j'ai 2 serveurs MCP connectés
    Et que le serveur A expose 2 ressources UI
    Et que le serveur B expose 1 ressource UI
    Quand j'ouvre le navigateur de ressources MCP
    Alors je vois 3 ressources UI au total
    Et chaque ressource indique son serveur d'origine

  Scénario: Prévisualiser une ressource UI dans le panneau
    Étant donné qu'une ressource UI "ui://chart-viewer" est disponible
    Quand je clique sur cette ressource dans le navigateur
    Alors le panneau d'artifact s'ouvre
    Et le contenu HTML de la ressource est rendu dans un iframe sandboxé
    Et un badge "MCP App" est affiché

  Scénario: Ressources UI de type text/html uniquement
    Étant donné qu'un serveur MCP déclare une ressource avec type MIME "application/json"
    Quand les ressources sont chargées
    Alors cette ressource est ignorée pour l'affichage UI
    Et seules les ressources "text/html" sont disponibles pour prévisualisation


Fonctionnalité: MCP Apps — Communication JSON-RPC via postMessage
  Scénario: MCP App envoie un message JSON-RPC via postMessage
    Étant donné qu'une MCP App est rendue dans un iframe
    Et que l'app tente d'envoyer un message JSON-RPC via postMessage
    Quand le message est reçu par l'hôte
    Alors l'hôte route le message vers le serveur MCP approprié
    Et la réponse du serveur est renvoyée à l'iframe via postMessage

  Scénario: MCP App appelle une méthode de ressource
    Étant donné qu'une MCP App affichée veut récupérer des données
    Quand l'app envoie un message JSON-RPC "resources/read" avec l'URI d'une ressource
    Alors le serveur MCP traite la requête
    Et renvoie le contenu de la ressource
    Et l'app reçoit la réponse via postMessage

  Scénario: Auditer tous les messages JSON-RPC
    Étant donné qu'une MCP App communique avec son serveur
    Quand des messages JSON-RPC sont échangés via postMessage
    Alors tous les messages sont loggés dans la console développeur
    Et l'utilisateur peut auditer les interactions

  Scénario: Bloquer les messages provenant d'origines inconnues
    Étant donné qu'un message postMessage est reçu
    Et que l'origine ne correspond pas à une iframe MCP App active
    Quand le message est traité
    Alors le message est rejeté
    Et aucune requête n'est envoyée au serveur MCP


Fonctionnalité: MCP Apps — Liaison outils ↔ UI
  Scénario: Outil MCP avec métadonnée ui/resourceUri
    Étant donné qu'un serveur MCP expose un outil "create_chart"
    Et que cet outil a la métadonnée "ui/resourceUri": "ui://chart-viewer"
    Quand l'assistant appelle l'outil "create_chart"
    Alors le résultat de l'outil est affiché
    Et un lien "Voir dans Chart Viewer" est proposé à l'utilisateur

  Scénario: Ouvrir l'UI associée à un résultat d'outil
    Étant donné qu'un outil a été exécuté avec une UI associée "ui://chart-viewer"
    Et que le résultat de l'outil contient des données JSON
    Quand je clique sur "Voir dans Chart Viewer"
    Alors le panneau d'artifact s'ouvre
    Et la MCP App "ui://chart-viewer" est rendue
    Et les données de l'outil sont passées à l'app via postMessage

  Scénario: Outil sans UI associée
    Étant donné qu'un outil MCP n'a pas de métadonnée "ui/resourceUri"
    Quand l'outil est exécuté
    Alors seul le résultat textuel est affiché
    Et aucune UI n'est proposée


Fonctionnalité: MCP Apps — Sécurité et isolation
  Scénario: MCP App rendue dans iframe sandboxé
    Étant donné qu'une ressource UI est affichée
    Quand le HTML est rendu
    Alors un iframe avec sandbox="allow-scripts allow-same-origin" est utilisé
    Et l'iframe ne peut pas accéder au DOM parent
    Et l'iframe ne peut pas naviguer la fenêtre principale

  Scénario: Inspecter le code HTML avant exécution
    Étant donné qu'une ressource UI est disponible
    Quand j'ouvre la ressource dans le panneau
    Alors un onglet "Code" est disponible
    Et je peux voir le code HTML source complet
    Et je peux décider de ne pas exécuter la preview

  Scénario: Consentement utilisateur pour invocation d'outils
    Étant donné qu'une MCP App tente d'invoquer un outil via JSON-RPC
    Quand le message "tools/call" est reçu
    Alors une modale de confirmation est affichée à l'utilisateur
    Et l'outil n'est invoqué que si l'utilisateur confirme
    Et le refus est communiqué à l'app

  Scénario: Limiter les permissions sandbox
    Étant donné qu'une MCP App est rendue
    Quand l'iframe est créé
    Alors les permissions sont limitées à "allow-scripts allow-same-origin"
    Et "allow-forms", "allow-popups", "allow-top-navigation" sont désactivés


Fonctionnalité: MCP Apps — Fallbacks et compatibilité
  Scénario: Fallback texte pour outil avec UI
    Étant donné qu'un outil MCP a une UI associée mais que l'hôte ne supporte pas les MCP Apps
    Quand l'outil est exécuté
    Alors le résultat textuel de l'outil est affiché normalement
    Et l'expérience utilisateur reste fonctionnelle

  Scénario: Ressource UI indisponible
    Étant donné qu'un outil référence "ui://unknown-app"
    Et que cette ressource n'est pas déclarée par le serveur
    Quand l'outil est exécuté
    Alors un avertissement est affiché
    Et seul le résultat textuel est montré
    Et l'application ne crash pas

  Scénario: Serveur MCP déconnecté
    Étant donné qu'une MCP App est affichée et provient d'un serveur X
    Et que le serveur X se déconnecte
    Quand l'app tente d'envoyer un message JSON-RPC
    Alors un message d'erreur "Serveur déconnecté" est affiché
    Et l'app ne peut plus communiquer avec le serveur


Fonctionnalité: MCP Apps — Gestion d'erreurs
  Scénario: Erreur de chargement d'une ressource UI
    Étant donné que je tente d'ouvrir une ressource UI
    Et que le serveur MCP renvoie une erreur lors de la récupération
    Quand l'erreur est reçue
    Alors un message d'erreur explicite est affiché dans le panneau
    Et l'utilisateur peut réessayer

  Scénario: HTML invalide dans une ressource UI
    Étant donné qu'une ressource UI contient du HTML mal formé
    Quand la ressource est rendue dans l'iframe
    Alors le navigateur affiche le contenu au mieux de ses capacités
    Et aucune erreur JavaScript ne fait crasher l'hôte

  Scénario: Timeout de communication JSON-RPC
    Étant donné qu'une MCP App envoie une requête JSON-RPC
    Et que le serveur ne répond pas dans les 10 secondes
    Quand le timeout est atteint
    Alors une erreur de timeout est renvoyée à l'app via postMessage
    Et l'utilisateur est notifié

  Scénario: Erreur dans le code JavaScript de la MCP App
    Étant donné qu'une MCP App contient une erreur JavaScript
    Quand l'erreur se produit dans l'iframe
    Alors l'erreur est capturée et loggée
    Et l'app affiche son propre gestionnaire d'erreur
    Et l'hôte reste stable
```
