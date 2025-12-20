# Gestion des artifacts — Specs fonctionnelles

## User Stories

### Affichage et interaction de base

- US-ART-01 — En tant qu'utilisateur, je veux que les artifacts générés par l'assistant apparaissent comme des cartes dédiées dans le fil afin de les identifier et les ouvrir facilement.
- US-ART-02 — En tant qu'utilisateur, je veux ouvrir un panneau de détail d'un artifact afin de le prévisualiser et d'accéder aux actions (copie, téléchargement, renommage).
- US-ART-03 — En tant qu'utilisateur, je veux basculer entre un mode "Preview" et un mode "Code" pour certains types d'artifacts afin de voir soit le rendu soit la source.
- US-ART-04 — En tant qu'utilisateur, je veux copier le contenu d'un artifact afin de le réutiliser rapidement.
- US-ART-05 — En tant qu'utilisateur, je veux télécharger un artifact avec une extension cohérente (type/langage) afin de l'exporter localement.
- US-ART-06 — En tant qu'utilisateur, je veux renommer un artifact afin de mieux le retrouver dans la conversation.
- US-ART-07 — En tant qu'utilisateur, je veux redimensionner et fermer le panneau d'artifact afin d'adapter l'espace à mon besoin.
- US-ART-08 — En tant qu'utilisateur, je veux retrouver les artifacts d'une conversation après rechargement afin de conserver l'historique et les exports.
- US-ART-09 — En tant qu'utilisateur, je veux que les erreurs de rendu d'un artifact (diagramme/React) soient affichées proprement afin de comprendre quoi corriger.

### Versioning et historique

- US-ART-10 — En tant qu'utilisateur, je veux accéder aux versions précédentes d'un artifact afin de consulter ou restaurer une version antérieure.
- US-ART-11 — En tant qu'utilisateur, je veux voir l'historique des modifications d'un artifact afin de comprendre son évolution.
- US-ART-12 — En tant qu'utilisateur, je veux basculer entre différentes versions d'un artifact afin de les comparer.

### Content Blocks et contenu enrichi

- US-ART-13 — En tant qu'utilisateur, je veux que le texte avant et après un artifact soit préservé afin de conserver le contexte de l'assistant.
- US-ART-14 — En tant qu'utilisateur, je veux voir le raisonnement de l'assistant (reasoning) dans une section dédiée afin de comprendre sa réflexion.
- US-ART-15 — En tant qu'utilisateur, je veux voir les appels d'outils effectués par l'assistant afin de suivre les actions entreprises.
- US-ART-16 — En tant qu'utilisateur, je veux que plusieurs artifacts dans un même message soient affichés dans le bon ordre afin de suivre la logique de l'assistant.

### Sécurité et robustesse

- US-ART-17 — En tant qu'utilisateur, je veux que le code HTML/React généré soit isolé du reste de l'application afin d'éviter tout risque de sécurité.
- US-ART-18 — En tant qu'utilisateur, je veux que le contenu SVG soit assaini afin d'éviter l'exécution de scripts malveillants.
- US-ART-19 — En tant qu'utilisateur, je veux être informé si un artifact est trop volumineux afin de comprendre les limites du système.

### Accessibilité et responsive

- US-ART-20 — En tant qu'utilisateur utilisant un lecteur d'écran, je veux naviguer efficacement entre les artifacts afin d'accéder au contenu.
- US-ART-21 — En tant qu'utilisateur sur mobile, je veux que le panneau d'artifact s'adapte à mon écran afin d'avoir une expérience optimale.

### Intégration MCP Apps

- US-MCP-01 — En tant qu'utilisateur, je veux me connecter à des serveurs MCP afin d'accéder à des ressources et interfaces utilisateur externes.
- US-MCP-02 — En tant qu'utilisateur, je veux voir la liste des ressources UI pré-déclarées (ui://) disponibles sur mes serveurs MCP afin de savoir ce qui est accessible.
- US-MCP-03 — En tant qu'utilisateur, je veux prévisualiser une ressource MCP App dans le panneau d'artifact afin de voir son interface utilisateur.
- US-MCP-04 — En tant qu'utilisateur, je veux que les MCP Apps s'exécutent dans un environnement isolé afin de garantir la sécurité de mes données.
- US-MCP-05 — En tant qu'utilisateur, je veux voir quand un outil MCP a une interface UI associée afin de bénéficier d'une expérience enrichie.
- US-MCP-06 — En tant qu'utilisateur, je veux que les MCP Apps communiquent avec leur serveur via JSON-RPC afin qu'elles puissent récupérer des données dynamiques.
- US-MCP-07 — En tant qu'utilisateur, je veux être notifié quand une MCP App tente d'invoquer un outil afin de garder le contrôle sur les actions effectuées.
- US-MCP-08 — En tant qu'utilisateur, je veux inspecter le code HTML d'une MCP App avant son exécution afin de vérifier son contenu.
- US-MCP-09 — En tant qu'utilisateur, je veux que les MCP Apps fonctionnent avec des fallbacks texte afin de maintenir la compatibilité avec tous les assistants.
- US-MCP-10 — En tant qu'utilisateur, je veux gérer mes connexions aux serveurs MCP (ajouter/supprimer/configurer) afin de contrôler mes intégrations.

## Critères d'acceptation (Gherkin)

```gherkin
# language: fr

Fonctionnalité: Détection et affichage des artifacts dans le fil
  Scénario: Afficher une carte d'artifact quand la réponse contient un tag valide
    Étant donné que la réponse de l'assistant contient un bloc artifact valide
      """
      <artifact type="code" title="Hello" language="typescript">
      console.log("hi")
      </artifact>
      """
    Quand le message est rendu dans la conversation
    Alors le contenu du bloc artifact n'est pas affiché comme du texte dans le fil
    Et une carte d'artifact est affichée à la place
    Et la carte affiche le titre "Hello"
    Et la carte affiche un badge de type correspondant à "code"

  Scénario: Conserver le texte autour d'un artifact (interleaving)
    Étant donné que la réponse de l'assistant contient du texte avant et après un artifact
    Quand le message est rendu dans la conversation
    Alors le texte avant est affiché avant la carte d'artifact
    Et le texte après est affiché après la carte d'artifact

  Scénario: Gérer plusieurs artifacts dans un même message
    Étant donné que la réponse de l'assistant contient deux artifacts valides
    Quand le message est rendu dans la conversation
    Alors deux cartes d'artifacts sont affichées
    Et l'ordre des cartes respecte l'ordre des blocs dans la réponse

  Scénario: Ne pas créer d'artifact si le tag est invalide
    Étant donné que la réponse de l'assistant contient un tag artifact invalide (type inconnu ou titre manquant)
    Quand le message est rendu dans la conversation
    Alors aucun artifact n'est créé
    Et le contenu est affiché comme du texte normal


Fonctionnalité: Content Blocks et contenu enrichi
  Scénario: Afficher du texte, un artifact, puis du texte à nouveau
    Étant donné que la réponse de l'assistant contient les content blocks suivants dans l'ordre :
      | type     | contenu                  |
      | text     | "Voici le code :"        |
      | artifact | artifact-id-123          |
      | text     | "N'hésitez pas à tester" |
    Quand le message est rendu dans la conversation
    Alors les blocks sont affichés dans l'ordre exact
    Et le texte avant l'artifact est affiché en markdown
    Et la carte de l'artifact est cliquable
    Et le texte après l'artifact est affiché en markdown

  Scénario: Afficher une section de raisonnement avant un artifact
    Étant donné que la réponse de l'assistant contient un content block de type "reasoning"
    Et un content block de type "artifact"
    Quand le message est rendu dans la conversation
    Alors la section de raisonnement est affichée dans une zone repliable
    Et la carte d'artifact est affichée après la section de raisonnement

  Scénario: Afficher des appels d'outils dans le message
    Étant donné que la réponse de l'assistant contient un content block de type "tool_call"
    Avec le nom d'outil "web_search" et des paramètres
    Quand le message est rendu dans la conversation
    Alors l'appel d'outil est affiché avec son nom
    Et les paramètres de l'appel sont visibles

  Scénario: Ordre strict des content blocks
    Étant donné que la réponse de l'assistant contient 5 content blocks dans un ordre spécifique
    Quand le message est rendu dans la conversation
    Alors les 5 blocks sont affichés dans le même ordre exact
    Et aucun block n'est déplacé ou réorganisé


Fonctionnalité: Versioning des artifacts
  Scénario: Créer une première version lors de la création d'un artifact
    Étant donné que l'assistant génère un nouvel artifact
    Quand l'artifact est créé
    Alors l'artifact contient une version initiale dans son tableau de versions
    Et la version initiale contient le contenu de l'artifact
    Et la version initiale a un timestamp de création

  Scénario: Créer une nouvelle version lors de la modification d'un artifact
    Étant donné qu'un artifact "Script Python" existe avec 1 version
    Et que l'assistant génère une version modifiée du même artifact
    Quand la nouvelle version est créée
    Alors l'artifact contient 2 versions dans son tableau
    Et la version la plus récente est affichée par défaut
    Et les deux versions ont des timestamps différents

  Scénario: Sélectionner une version précédente dans le panneau
    Étant donné qu'un artifact existe avec 3 versions
    Et que le panneau d'artifact est ouvert
    Quand je sélectionne "Version 1" dans le menu déroulant des versions
    Alors le contenu affiché correspond à la version 1
    Et le titre indique quelle version est affichée

  Scénario: Comparer deux versions d'un artifact
    Étant donné qu'un artifact existe avec 2 versions
    Et que le panneau d'artifact est ouvert sur la version actuelle
    Quand je bascule vers la version 1
    Et que je compare visuellement le contenu
    Alors je peux identifier les différences entre les versions

  Scénario: Le sélecteur de version n'apparaît que s'il y a plusieurs versions
    Étant donné qu'un artifact existe avec 1 seule version
    Quand j'ouvre le panneau d'artifact
    Alors le menu déroulant des versions n'est pas affiché

  Scénario: Limitation du nombre de versions conservées
    Étant donné qu'un artifact existe avec 10 versions
    Quand l'assistant génère une 11ème version
    Alors le système conserve les 10 versions les plus récentes
    Et la version la plus ancienne est supprimée


Fonctionnalité: Ouverture/fermeture du panneau d'artifact
  Scénario: Ouvrir le panneau depuis une carte d'artifact
    Étant donné qu'une carte d'artifact est visible dans une conversation
    Quand je clique sur la carte d'artifact
    Alors le panneau d'artifact s'ouvre sur la droite
    Et le panneau affiche le titre de l'artifact
    Et le panneau affiche un badge du type d'artifact

  Scénario: Ouvrir un autre artifact alors que le panneau est déjà ouvert
    Étant donné que le panneau d'artifact est ouvert sur un artifact A
    Et qu'un autre artifact B est visible dans le fil
    Quand je clique sur la carte de l'artifact B
    Alors le panneau affiche le contenu de l'artifact B

  Scénario: Fermer le panneau via le bouton de fermeture
    Étant donné que le panneau d'artifact est ouvert
    Quand je clique sur le bouton de fermeture du panneau
    Alors le panneau d'artifact se ferme

  Scénario: Fermer le panneau au clavier
    Étant donné que le panneau d'artifact est ouvert
    Quand j'appuie sur la touche "Escape"
    Alors le panneau d'artifact se ferme

  Scénario: Le panneau se ferme lors d'un changement de contexte
    Étant donné que le panneau d'artifact est ouvert
    Quand je change de conversation ou que je bascule sur un tableau de bord de projet
    Alors le panneau d'artifact se ferme


Fonctionnalité: Renommage d'un artifact
  Scénario: Renommer un artifact depuis le panneau
    Étant donné que le panneau d'artifact est ouvert
    Quand je clique sur le titre de l'artifact
    Et que je saisis le nouveau titre "Nouveau titre"
    Et que je valide
    Alors le panneau affiche le titre "Nouveau titre"
    Et la carte d'artifact dans le fil affiche "Nouveau titre"
    Et le nouveau titre est conservé après rechargement de la page

  Scénario: Annuler le renommage d'un artifact
    Étant donné que je suis en train d'éditer le titre d'un artifact dans le panneau
    Quand j'annule l'édition
    Alors le titre reste inchangé

  Scénario: Refuser un renommage vide
    Étant donné que je suis en train d'éditer le titre d'un artifact dans le panneau
    Quand je valide un titre vide
    Alors le titre n'est pas modifié

  Scénario: Tronquer les titres très longs dans la carte
    Étant donné qu'un artifact a un titre de plus de 50 caractères
    Quand la carte de l'artifact est affichée dans le fil
    Alors le titre est tronqué avec "..." à la fin
    Et le titre complet est visible au survol (tooltip)


Fonctionnalité: Redimensionnement du panneau d'artifact
  Scénario: Redimensionner le panneau à la souris
    Étant donné que le panneau d'artifact est ouvert
    Quand je fais glisser la poignée de redimensionnement
    Alors la largeur du panneau est mise à jour en temps réel

  Scénario: Contraindre la largeur minimale et maximale
    Étant donné que le panneau d'artifact est ouvert
    Quand je tente de redimensionner le panneau en dessous de 20% de largeur
    Alors la largeur est limitée à 20%
    Quand je tente de redimensionner le panneau au-dessus de 80% de largeur
    Alors la largeur est limitée à 80%

  Scénario: Largeur par défaut du panneau
    Étant donné qu'aucun artifact n'a encore été ouvert dans cette session
    Quand j'ouvre le panneau d'artifact pour la première fois
    Alors la largeur par défaut est de 40% de l'écran


Fonctionnalité: Prévisualisation et mode code
  Scénario: Afficher le rendu de prévisualisation pour les types compatibles
    Étant donné qu'un artifact de type "html" ou "react" ou "svg" ou "mermaid" ou "markdown" existe
    Quand j'ouvre le panneau de cet artifact
    Alors un onglet "Preview" est disponible
    Et un onglet "Code" est disponible
    Et le panneau affiche le rendu en mode "Preview" par défaut

  Scénario: Afficher le code source en mode "Code"
    Étant donné qu'un artifact de type compatible avec "Preview/Code" est ouvert
    Quand je sélectionne l'onglet "Code"
    Alors le panneau affiche le contenu en tant que code source

  Scénario: Les artifacts de type "code" s'affichent directement en code
    Étant donné qu'un artifact de type "code" existe
    Quand j'ouvre le panneau de cet artifact
    Alors le contenu est affiché en tant que code (avec coloration syntaxique si possible)


Fonctionnalité: Actions sur un artifact (copie, téléchargement)
  Scénario: Copier le contenu d'un artifact
    Étant donné qu'un artifact est ouvert dans le panneau
    Quand je clique sur "Copy"
    Alors le contenu de l'artifact est copié dans le presse-papiers
    Et un feedback "Copied!" est affiché

  Scénario: Télécharger un artifact
    Étant donné qu'un artifact est ouvert dans le panneau
    Quand je clique sur "Download"
    Alors un fichier est téléchargé
    Et le nom du fichier est dérivé du titre de l'artifact
    Et l'extension du fichier est cohérente avec le type (ou le langage si présent)

  Scénario: Télécharger un artifact de type code avec langage spécifique
    Étant donné qu'un artifact de type "code" avec language="typescript" existe
    Quand je clique sur "Download"
    Alors le fichier téléchargé a l'extension ".ts"

  Scénario: Noms de fichiers sécurisés lors du téléchargement
    Étant donné qu'un artifact a un titre contenant des caractères spéciaux "Mon/Fichier:test"
    Quand je clique sur "Download"
    Alors le nom du fichier téléchargé remplace les caractères invalides
    Et le nom est au format "Mon-Fichier-test.ext"


Fonctionnalité: Rendu HTML — Isolation et encapsulation
  Scénario: HTML - encapsuler le contenu fragment dans un document complet
    Étant donné qu'un artifact de type "html" contient un fragment sans balise <html>
      """
      <div>Hello World</div>
      """
    Quand j'ouvre le panneau en mode "Preview"
    Alors le contenu est rendu dans un contexte HTML complet (doctype/head/body)
    Et le fragment est injecté dans le <body>
    Et un <meta charset="UTF-8"> est présent
    Et un <meta name="viewport"> est présent

  Scénario: HTML - ajouter des styles par défaut
    Étant donné qu'un artifact de type "html" contient un fragment simple
    Quand j'ouvre le panneau en mode "Preview"
    Alors des styles CSS de base sont injectés (box-sizing, margin, padding, font-family)

  Scénario: HTML - ne pas encapsuler un document HTML complet
    Étant donné qu'un artifact de type "html" contient déjà une balise <html>
    Quand j'ouvre le panneau en mode "Preview"
    Alors le contenu n'est pas ré-encapsulé
    Et le document est rendu tel quel dans l'iframe

  Scénario: HTML - isolation via iframe sandbox
    Étant donné qu'un artifact de type "html" contient du JavaScript
    Quand j'ouvre le panneau en mode "Preview"
    Alors le contenu est rendu dans un iframe avec sandbox="allow-scripts"
    Et le JavaScript peut s'exécuter dans l'iframe
    Et le JavaScript ne peut pas accéder à la page parent
    Et l'iframe a referrerPolicy="no-referrer"


Fonctionnalité: Rendu React — Transpilation et sécurité
  Scénario: React - transpiler le JSX en JavaScript
    Étant donné qu'un artifact de type "react" contient du code JSX
      """
      function App() {
        return <div>Hello React</div>
      }
      """
    Quand j'ouvre le panneau en mode "Preview"
    Alors le code JSX est transpilé en JavaScript via Sucrase
    Et le code transpilé est exécuté dans un iframe

  Scénario: React - supprimer les imports et exports
    Étant donné qu'un artifact de type "react" contient des lignes import/export
      """
      import React from 'react';
      export default function App() { return <div>Test</div> }
      """
    Quand le code est transpilé
    Alors les lignes "import" sont supprimées
    Et "export default function App" est converti en "function App"

  Scénario: React - détecter et rendre le composant principal
    Étant donné qu'un artifact de type "react" définit une fonction "App"
    Quand j'ouvre le panneau en mode "Preview"
    Alors le système détecte le composant "App"
    Et rend ce composant dans le div#root de l'iframe

  Scénario: React - ordre de recherche des composants
    Étant donné qu'un artifact de type "react" définit plusieurs fonctions
    Et qu'aucune ne s'appelle "App"
    Quand le système cherche le composant à rendre
    Alors il cherche dans l'ordre: App, Main, Root, Example, Demo, Counter, Button, Card, Form, List, MyComponent
    Et rend le premier composant trouvé

  Scénario: React - afficher une erreur de compilation
    Étant donné qu'un artifact de type "react" contient du code JSX invalide
    Quand j'ouvre le panneau en mode "Preview"
    Alors un message "Failed to compile React code" est affiché
    Et les détails de l'erreur sont visibles

  Scénario: React - afficher un message si aucun composant n'est détecté
    Étant donné qu'un artifact de type "react" ne définit aucun composant attendu
    Quand j'ouvre le panneau en mode "Preview"
    Alors un message indique qu'aucun composant n'a été trouvé
    Et la liste des noms de composants recherchés est affichée

  Scénario: React - utiliser React 18 depuis unpkg CDN
    Étant donné qu'un artifact de type "react" est rendu
    Quand le panneau affiche la preview
    Alors React 18 et ReactDOM 18 sont chargés depuis unpkg.com
    Et si le CDN est inaccessible, un message d'erreur réseau est affiché

  Scénario: React - isolation via iframe sandbox
    Étant donné qu'un artifact de type "react" contient du code
    Quand j'ouvre le panneau en mode "Preview"
    Alors le composant est rendu dans un iframe avec sandbox="allow-scripts"
    Et le composant ne peut pas accéder à la page parent


Fonctionnalité: Rendu SVG — Assainissement
  Scénario: SVG - assainir le contenu avant affichage
    Étant donné qu'un artifact de type "svg" contient du contenu potentiellement dangereux
      """
      <svg><script>alert('XSS')</script></svg>
      """
    Quand j'ouvre le panneau en mode "Preview"
    Alors le contenu SVG est traité par DOMPurify
    Et les balises <script> sont supprimées
    Et le SVG assaini est affiché

  Scénario: SVG - configurer DOMPurify pour autoriser les balises SVG
    Étant donné qu'un artifact de type "svg" contient des éléments SVG valides
    Quand le contenu est assaini
    Alors DOMPurify est configuré avec USE_PROFILES: { svg: true, svgFilters: true }
    Et tous les éléments SVG valides sont conservés


Fonctionnalité: Rendu Mermaid — Gestion d'erreurs
  Scénario: Mermaid - afficher une erreur de rendu
    Étant donné qu'un artifact de type "mermaid" contient une définition invalide
    Quand j'ouvre le panneau en mode "Preview"
    Alors un message d'erreur de rendu est affiché
    Et le diagramme n'est pas affiché

  Scénario: Mermaid - normaliser le code source avant rendu
    Étant donné qu'un artifact de type "mermaid" contient des backticks (```)
    Quand le contenu est rendu
    Alors les délimiteurs de code (```) sont supprimés
    Et seul le code Mermaid pur est passé à la bibliothèque


Fonctionnalité: Rendu Markdown
  Scénario: Markdown - utiliser GitHub Flavored Markdown
    Étant donné qu'un artifact de type "markdown" contient du GFM
    Quand j'ouvre le panneau en mode "Preview"
    Alors le contenu est rendu avec support des tables, strikethrough, etc.

  Scénario: Markdown - appliquer la coloration syntaxique aux blocs de code
    Étant donné qu'un artifact de type "markdown" contient un bloc de code
    Quand j'ouvre le panneau en mode "Preview"
    Alors le bloc de code est affiché avec coloration syntaxique


Fonctionnalité: Rendu Code — Coloration syntaxique
  Scénario: Code - appliquer Prism pour la coloration syntaxique
    Étant donné qu'un artifact de type "code" avec language="javascript" existe
    Quand j'ouvre le panneau
    Alors le code est affiché avec coloration syntaxique Prism
    Et la coloration correspond au langage JavaScript

  Scénario: Code - afficher les numéros de ligne
    Étant donné qu'un artifact de type "code" existe
    Quand j'ouvre le panneau
    Alors les numéros de ligne sont affichés à gauche du code

  Scénario: Code - bouton de copie
    Étant donné qu'un artifact de type "code" est affiché
    Quand je survole le bloc de code
    Alors un bouton "Copy" est visible
    Et je peux copier le code en un clic


Fonctionnalité: Persistance
  Scénario: Retrouver les artifacts après rechargement
    Étant donné que j'ai une conversation contenant au moins un artifact
    Quand je recharge la page
    Alors la conversation contient toujours ses artifacts
    Et les cartes d'artifacts restent visibles dans les messages

  Scénario: Conserver les versions après rechargement
    Étant donné qu'un artifact existe avec 3 versions
    Quand je recharge la page
    Alors l'artifact contient toujours ses 3 versions
    Et je peux naviguer entre les versions

  Scénario: Conserver les renommages après rechargement
    Étant donné que j'ai renommé un artifact en "Mon Script"
    Quand je recharge la page
    Alors l'artifact affiche toujours le titre "Mon Script"


Fonctionnalité: Gestion des erreurs et cas limites
  Scénario: Artifact avec contenu vide
    Étant donné qu'un artifact contient une chaîne vide
    Quand j'ouvre le panneau
    Alors un message "No content" ou similaire est affiché

  Scénario: Artifact dépassant la taille limite
    Étant donné qu'un artifact contient plus de 1MB de contenu
    Quand l'artifact est créé
    Alors un avertissement est affiché
    Et l'artifact peut être affiché mais avec un avertissement de performance

  Scénario: Échec de chargement du CDN React
    Étant donné qu'un artifact de type "react" doit être rendu
    Et que le CDN unpkg.com est inaccessible
    Quand j'ouvre le panneau en mode "Preview"
    Alors un message d'erreur réseau est affiché
    Et un lien vers le mode "Code" est proposé

  Scénario: Caractères UTF-8 invalides dans un artifact
    Étant donné qu'un artifact contient des séquences d'octets UTF-8 invalides
    Quand l'artifact est affiché
    Alors les caractères de remplacement (�) sont affichés
    Et aucune erreur JavaScript n'est levée

  Scénario: Titre d'artifact avec caractères spéciaux
    Étant donné qu'un artifact a un titre contenant <, >, &, "
    Quand la carte de l'artifact est affichée
    Alors les caractères spéciaux sont correctement échappés
    Et aucune injection HTML n'est possible


Fonctionnalité: Accessibilité
  Scénario: Navigation au clavier dans le panneau
    Étant donné que le panneau d'artifact est ouvert
    Quand j'utilise la touche Tab
    Alors le focus se déplace entre les éléments interactifs (boutons, onglets)
    Et l'ordre de focus est logique (titre, onglets, actions, fermeture)

  Scénario: Lecteur d'écran - annoncer le type d'artifact
    Étant donné qu'une carte d'artifact de type "html" est affichée
    Quand un lecteur d'écran lit la carte
    Alors le type "HTML" est annoncé
    Et le titre de l'artifact est annoncé

  Scénario: Lecteur d'écran - annoncer l'ouverture du panneau
    Étant donné qu'une carte d'artifact est visible
    Quand je clique sur la carte avec un lecteur d'écran actif
    Alors le lecteur d'écran annonce "Artifact panel opened"
    Et annonce le titre et le type de l'artifact ouvert

  Scénario: Contraste suffisant pour les badges
    Étant donné que différents types d'artifacts ont des badges colorés
    Quand les badges sont affichés
    Alors le ratio de contraste respecte WCAG AA (4.5:1 minimum)

  Scénario: Focus visible sur les éléments interactifs
    Étant donné que le panneau d'artifact est ouvert
    Quand je navigue au clavier
    Alors chaque élément focusé a un indicateur de focus visible


Fonctionnalité: Comportement responsive
  Scénario: Panneau en plein écran sur mobile
    Étant donné que je suis sur un écran de moins de 768px de largeur
    Quand j'ouvre un artifact
    Alors le panneau occupe 100% de la largeur
    Et le panneau se superpose au fil de conversation

  Scénario: Désactiver le redimensionnement sur mobile
    Étant donné que je suis sur un écran de moins de 768px de largeur
    Et que le panneau d'artifact est ouvert
    Quand je cherche la poignée de redimensionnement
    Alors la poignée n'est pas visible
    Et je ne peux pas redimensionner le panneau

  Scénario: Panneau adaptable sur tablette
    Étant donné que je suis sur un écran entre 768px et 1024px de largeur
    Quand j'ouvre un artifact
    Alors le panneau occupe 60% de la largeur par défaut
    Et je peux le redimensionner entre 40% et 80%

  Scénario: Geste de balayage pour fermer sur mobile
    Étant donné que je suis sur un écran tactile
    Et que le panneau d'artifact est ouvert
    Quand je fais glisser le panneau vers la droite
    Alors le panneau se ferme avec une animation


Fonctionnalité: Streaming et parsing en temps réel
  Scénario: Détecter un artifact pendant le streaming
    Étant donné que l'assistant génère une réponse en streaming
    Et que la réponse contient un tag <artifact>
    Quand le tag <artifact> est partiellement reçu
    Alors le parser détecte le début de l'artifact
    Et conserve le contenu en attente de fermeture

  Scénario: Compléter un artifact à la fin du streaming
    Étant donné qu'un artifact est en cours de réception
    Et que le tag </artifact> est reçu
    Quand le streaming se termine
    Alors l'artifact complet est créé
    Et la carte de l'artifact apparaît dans le fil

  Scénario: Gérer une interruption de streaming avec artifact incomplet
    Étant donné qu'un artifact est en cours de réception
    Et que le streaming est interrompu avant le tag </artifact>
    Quand le streaming s'arrête
    Alors l'artifact incomplet n'est pas créé
    Et le contenu partiel est affiché comme du texte normal

  Scénario: Parser plusieurs artifacts dans un même stream
    Étant donné que l'assistant génère une réponse contenant 2 artifacts
    Quand la réponse est reçue en streaming
    Alors le premier artifact est détecté et créé en premier
    Et le second artifact est détecté et créé ensuite
    Et l'ordre est préservé


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

## Contraintes techniques

### Taille et limites

- **Taille maximale d'un artifact** : 1 MB (1 048 576 octets)
- **Nombre maximal d'artifacts par message** : Aucune limite stricte, mais recommandation de 5 maximum pour la performance
- **Nombre de versions conservées par artifact** : 10 versions maximum (FIFO, la plus ancienne est supprimée)
- **Longueur maximale du titre** : 200 caractères
- **Affichage du titre dans la carte** : Tronqué à 50 caractères avec "..." si dépassé

### Dimensions du panneau

- **Largeur par défaut** : 40% de la largeur de la fenêtre
- **Largeur minimale** : 20% (ou 300px minimum absolu)
- **Largeur maximale** : 80%
- **Breakpoint mobile** : < 768px → panneau en plein écran (100%)
- **Breakpoint tablette** : 768px - 1024px → panneau 60% par défaut

### Timeouts et délais

- **Timeout de chargement CDN React** : 10 secondes
- **Délai d'affichage du feedback "Copied!"** : 2 secondes
- **Debounce du redimensionnement** : 16ms (60fps)

### Sécurité

- **Iframe sandbox pour HTML** : `sandbox="allow-scripts"`, `referrerPolicy="no-referrer"`
- **Iframe sandbox pour React** : `sandbox="allow-scripts"`
- **Assainissement SVG** : DOMPurify avec profil SVG activé
- **Échappement des titres** : Tous les caractères HTML spéciaux doivent être échappés
- **Validation des noms de fichiers** : Caractères invalides (`/`, `:`, `*`, `?`, `"`, `<`, `>`, `|`) remplacés par `-`

### Parsing des artifacts

- **Format du tag** : `<artifact type="..." title="..." language="...">contenu</artifact>`
- **Attributs requis** : `type`, `title`
- **Attribut optionnel** : `language` (pour type="code" uniquement)
- **Types valides** : `code`, `html`, `react`, `markdown`, `svg`, `mermaid`
- **Génération d'ID** : UUID v4 via `crypto.randomUUID()`

### Dépendances externes

- **React/ReactDOM pour preview React** : CDN unpkg.com, version 18
- **Sucrase** : Transpilation JSX → JS
- **DOMPurify** : Assainissement SVG
- **Prism** : Coloration syntaxique du code
- **Mermaid** : Rendu des diagrammes
- **ReactMarkdown** : Rendu Markdown avec plugin GFM

### Stockage (localStorage)

- **Clé de stockage** : `conversations` (contient tous les messages et artifacts)
- **Format** : JSON stringifié
- **Limite navigateur** : ~5-10 MB selon le navigateur
- **Backup** : Aucun backup automatique, responsabilité de l'utilisateur

### Performance

- **Rendu différé** : Les iframes ne sont rendus que lorsque le panneau est ouvert
- **Optimisation React** : `useMemo` pour éviter le re-wrapping du HTML
- **Virtualisation** : Non implémentée (peut être ajoutée pour de longues listes d'artifacts)

### MCP Apps (Model Context Protocol)

#### Connexion et serveurs

- **Protocole de communication** : JSON-RPC 2.0 sur transport SSE ou stdio
- **Nombre maximal de serveurs connectés** : Aucune limite stricte, recommandation de 5 maximum
- **Timeout de connexion** : 10 secondes
- **Reconnexion automatique** : Oui, avec backoff exponentiel (1s, 2s, 4s, 8s, max 30s)
- **Heartbeat/ping** : Toutes les 30 secondes pour détecter les déconnexions

#### Ressources UI (ui://)

- **Schéma URI** : `ui://template-name` (uniquement)
- **Type MIME supporté** : `text/html` exclusivement (v1.0)
- **Taille maximale d'une ressource UI** : 500 KB (512 000 octets)
- **Cache des ressources** : En mémoire, invalidé à la déconnexion du serveur
- **Nombre maximal de ressources UI par serveur** : 50

#### Communication JSON-RPC via postMessage

- **Timeout de requête JSON-RPC** : 10 secondes
- **Validation de l'origine** : Obligatoire, rejet des messages d'origines inconnues
- **Audit logging** : Tous les messages loggés dans la console développeur en mode développement
- **Rate limiting** : 100 messages par seconde maximum par iframe
- **Taille maximale d'un message** : 1 MB

#### Sécurité et sandbox

- **Iframe sandbox pour MCP Apps** : `sandbox="allow-scripts allow-same-origin"`, `referrerPolicy="no-referrer"`
- **Permissions explicitement refusées** : `allow-forms`, `allow-popups`, `allow-top-navigation`, `allow-downloads`
- **Content Security Policy (CSP)** : Recommandé pour les ressources UI
- **Consentement utilisateur** : Requis pour toute invocation d'outil via `tools/call`
- **Inspection pré-exécution** : Onglet "Code" disponible pour toutes les ressources UI

#### Métadonnées et liaison outils ↔ UI

- **Métadonnée standard** : `"ui/resourceUri": "ui://template-name"` dans les métadonnées d'outil
- **Passage de données** : Via postMessage JSON-RPC avec la méthode `resources/read`
- **Format des données** : JSON arbitraire, validé côté MCP App

#### Fallbacks et compatibilité

- **Fallback obligatoire** : Tous les outils MCP doivent fournir un résultat textuel utilisable sans UI
- **Version MCP minimale** : 1.0 (SEP-1865)
- **Rétrocompatibilité** : Les serveurs MCP sans support UI restent pleinement fonctionnels

#### Stockage

- **Configuration des serveurs** : Stockée dans localStorage sous la clé `mcp_servers`
- **Format** : `{ serverId: string, url: string, name: string, status: 'connected' | 'disconnected' }[]`
- **Credentials** : Non stockés en localStorage (utiliser des variables d'environnement ou saisie à chaque session)

#### Gestion d'erreurs

- **Timeout de chargement de ressource** : 10 secondes
- **Retry automatique** : Non, l'utilisateur doit réessayer manuellement
- **Erreurs JSON-RPC** : Code d'erreur standard + message descriptif renvoyé à l'app
- **Crash de l'iframe** : Détecté, l'iframe est rechargée avec un avertissement

## Glossaire

### Termes généraux

- **Artifact** : Bloc de contenu généré par l'assistant (code, HTML, React, SVG, etc.) affiché dans une carte dédiée
- **Content Block** : Unité structurelle d'un message (text, reasoning, tool_call, artifact)
- **Artifact Panel** : Panneau latéral droit affichant le détail d'un artifact
- **Preview Mode** : Mode d'affichage du rendu final d'un artifact (HTML, React, SVG, Mermaid, Markdown)
- **Code Mode** : Mode d'affichage du code source brut d'un artifact
- **Version** : Snapshot d'un artifact à un instant donné, conservé dans l'historique
- **Sandbox** : Attribut HTML d'isolation de sécurité pour les iframes
- **Streaming** : Réception progressive de la réponse de l'assistant en temps réel
- **DOMPurify** : Bibliothèque de nettoyage/assainissement de contenu HTML/SVG
- **Sucrase** : Transpileur JavaScript ultra-rapide pour convertir JSX en JS
- **GFM** : GitHub Flavored Markdown, extension du format Markdown standard

### Termes MCP Apps

- **MCP (Model Context Protocol)** : Protocole standard pour connecter des applications à des sources de données et outils externes
- **MCP Server** : Serveur exposant des ressources, outils et prompts via le protocole MCP
- **MCP App** : Interface utilisateur HTML interactive exposée par un serveur MCP via le schéma `ui://`
- **ui:// URI** : Schéma d'URI spécial pour référencer des ressources UI pré-déclarées
- **JSON-RPC** : Protocole d'appel de procédure à distance utilisé par MCP pour la communication
- **postMessage** : API JavaScript permettant la communication inter-fenêtres (iframe ↔ parent)
- **SSE (Server-Sent Events)** : Transport unidirectionnel serveur → client pour JSON-RPC
- **stdio** : Transport bidirectionnel via entrée/sortie standard pour JSON-RPC
- **MCPMessageBridge** : Composant routant les messages JSON-RPC entre iframes et serveurs MCP
- **Pre-declared resource** : Ressource déclarée par le serveur MCP au démarrage (vs ressource dynamique)
- **Tool metadata** : Métadonnées associées à un outil, incluant potentiellement `ui/resourceUri`

## Architecture des Content Blocks

Les messages de l'assistant utilisent une structure de `ContentBlock[]` permettant d'entrelacer différents types de contenu :

```typescript
type ContentBlock =
  | TextContentBlock        // Texte markdown standard
  | ReasoningContentBlock   // Section de raisonnement (modèles o-series)
  | ToolCallContentBlock    // Appels d'outils effectués par l'assistant
  | ArtifactContentBlock    // Référence à un artifact (par ID)
```

### TextContentBlock

```typescript
interface TextContentBlock {
  type: 'text';
  content: string; // Markdown
}
```

### ReasoningContentBlock

```typescript
interface ReasoningContentBlock {
  type: 'reasoning';
  content: string; // Texte de raisonnement
}
```

Affiché dans une zone repliable/dépliable pour montrer la réflexion de l'assistant.

### ToolCallContentBlock

```typescript
interface ToolCallContentBlock {
  type: 'tool_call';
  toolName: string;
  parameters: Record<string, any>;
  result?: string;
}
```

Affiche les outils utilisés par l'assistant (web_search, calculator, etc.).

### ArtifactContentBlock

```typescript
interface ArtifactContentBlock {
  type: 'artifact';
  artifactId: string; // UUID référençant un artifact dans la conversation
}
```

Référence un artifact qui sera affiché comme une carte cliquable.

### Ordre d'affichage

Les content blocks sont affichés dans l'ordre exact où ils apparaissent dans le tableau. Exemple :

```typescript
contentBlocks: [
  { type: 'text', content: 'Voici un exemple :' },
  { type: 'artifact', artifactId: 'uuid-123' },
  { type: 'text', content: 'Vous pouvez le tester.' },
  { type: 'reasoning', content: 'J\'ai choisi cette approche car...' }
]
```

Produira l'affichage :
1. Texte markdown "Voici un exemple :"
2. Carte de l'artifact
3. Texte markdown "Vous pouvez le tester."
4. Section de raisonnement repliable

## Structure de données Artifact

```typescript
interface Artifact {
  id: string;                    // UUID v4
  type: ArtifactType;            // 'code' | 'html' | 'react' | 'markdown' | 'svg' | 'mermaid'
  title: string;                 // Max 200 caractères
  content: string;               // Contenu actuel
  language?: string;             // Langage pour type="code" (ex: 'typescript', 'python')
  versions: ArtifactVersion[];   // Historique (max 10)
  createdAt: number;             // Timestamp Unix
  updatedAt: number;             // Timestamp Unix
}

interface ArtifactVersion {
  id: string;                    // UUID v4
  content: string;               // Contenu de cette version
  createdAt: number;             // Timestamp Unix
}
```

## Mapping des extensions de fichiers

Pour le téléchargement, les extensions sont déterminées ainsi :

### Par type d'artifact
- `code` → `.txt` (sauf si `language` est défini)
- `html` → `.html`
- `react` → `.jsx`
- `markdown` → `.md`
- `svg` → `.svg`
- `mermaid` → `.mmd`

### Par langage (pour type="code")
- `javascript` → `.js`
- `typescript` → `.ts`
- `python` → `.py`
- `java` → `.java`
- `cpp` → `.cpp`
- `c` → `.c`
- `csharp` → `.cs`
- `go` → `.go`
- `rust` → `.rs`
- `ruby` → `.rb`
- `php` → `.php`
- `swift` → `.swift`
- `kotlin` → `.kt`
- `sql` → `.sql`
- (et autres langages courants)

## Badges de type

Chaque type d'artifact a un badge coloré :

- **Code** : Bleu (`bg-blue-100 text-blue-800` en light, `bg-blue-900 text-blue-200` en dark)
- **HTML** : Rose (`bg-pink-100 text-pink-800` / `bg-pink-900 text-pink-200`)
- **React** : Cyan (`bg-cyan-100 text-cyan-800` / `bg-cyan-900 text-cyan-200`)
- **Markdown** : Violet (`bg-purple-100 text-purple-800` / `bg-purple-900 text-purple-200`)
- **SVG** : Jaune/Or (`bg-yellow-100 text-yellow-800` / `bg-yellow-900 text-yellow-200`)
- **Mermaid** : Vert (`bg-green-100 text-green-800` / `bg-green-900 text-green-200`)

Tous les badges doivent respecter un ratio de contraste WCAG AA minimum (4.5:1).

## Algorithme de détection de composant React

Lors du rendu d'un artifact de type "react", le système cherche un composant à rendre dans cet ordre :

1. `App`
2. `Main`
3. `Root`
4. `Example`
5. `Demo`
6. `Counter`
7. `Button`
8. `Card`
9. `Form`
10. `List`
11. `MyComponent`

Le **premier** composant trouvé dans cette liste est rendu. Si aucun n'est trouvé, un message d'erreur s'affiche.

## Notes de compatibilité

### Navigateurs supportés
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

### Fonctionnalités requises
- localStorage API
- Clipboard API (pour le bouton Copy)
- crypto.randomUUID (ou polyfill)
- iframe avec attribut sandbox
- Fetch API (pour chargement CDN)

### Fallbacks
- Si Clipboard API indisponible : utiliser `document.execCommand('copy')` comme fallback
- Si crypto.randomUUID indisponible : utiliser une fonction UUID polyfill
- Si CDN inaccessible : afficher message d'erreur avec lien vers mode Code

## Architecture MCP Apps

### Vue d'ensemble

L'intégration MCP Apps s'appuie sur l'infrastructure d'artifacts existante. Une MCP App est essentiellement un artifact de type spécial (`mcp-app`) dont le contenu HTML provient d'un serveur MCP externe plutôt que d'être généré par l'assistant.

**Composants principaux :**
1. **MCPServerManager** - Gère les connexions aux serveurs MCP
2. **MCPResourceBrowser** - UI pour naviguer dans les ressources `ui://` disponibles
3. **MCPAppPreview** - Renderer pour les MCP Apps (extension de HTMLPreview)
4. **MCPMessageBridge** - Routeur JSON-RPC entre iframes et serveurs MCP

### Structure de données

#### MCPServer

```typescript
interface MCPServer {
  id: string;                    // UUID v4
  name: string;                  // Nom affiché à l'utilisateur
  url?: string;                  // URL pour transport SSE
  command?: string;              // Commande pour transport stdio
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  resources: MCPResource[];      // Ressources UI disponibles
  tools: MCPTool[];              // Outils exposés par le serveur
  connectedAt?: number;          // Timestamp de connexion
  lastError?: string;            // Dernière erreur rencontrée
}
```

#### MCPResource

```typescript
interface MCPResource {
  uri: string;                   // Format: "ui://template-name"
  name: string;                  // Nom affiché
  description?: string;          // Description optionnelle
  mimeType: string;              // Doit être "text/html" pour v1.0
  serverId: string;              // Référence au serveur MCP
  content?: string;              // Contenu HTML (caché après récupération)
}
```

#### MCPTool

```typescript
interface MCPTool {
  name: string;                  // Nom de l'outil
  description: string;           // Description de l'outil
  inputSchema: object;           // JSON Schema des paramètres
  metadata?: {
    'ui/resourceUri'?: string;   // URI de l'UI associée (optionnel)
    [key: string]: any;
  };
  serverId: string;              // Référence au serveur MCP
}
```

#### MCPAppArtifact (extension d'Artifact)

```typescript
interface MCPAppArtifact extends Artifact {
  type: 'mcp-app';               // Type spécifique pour MCP Apps
  mcpResourceUri: string;        // URI de la ressource (ui://...)
  mcpServerId: string;           // ID du serveur MCP source
  mcpToolData?: any;             // Données de l'outil associé (si applicable)
}
```

### Flux de communication JSON-RPC

```
┌─────────────┐                ┌──────────────┐                ┌─────────────┐
│  MCP App    │                │    Hôte      │                │ MCP Server  │
│  (iframe)   │                │ (React App)  │                │             │
└──────┬──────┘                └──────┬───────┘                └──────┬──────┘
       │                              │                               │
       │ postMessage({                │                               │
       │   method: "resources/read",  │                               │
       │   params: {uri: "..."}       │                               │
       │ })                           │                               │
       ├─────────────────────────────>│                               │
       │                              │                               │
       │                              │ JSON-RPC request              │
       │                              ├──────────────────────────────>│
       │                              │                               │
       │                              │ JSON-RPC response             │
       │                              │<──────────────────────────────┤
       │                              │                               │
       │ postMessage({                │                               │
       │   result: {...}              │                               │
       │ })                           │                               │
       │<─────────────────────────────┤                               │
       │                              │                               │
```

### MCPMessageBridge - Routage des messages

Le `MCPMessageBridge` intercepte les messages `postMessage` des iframes MCP Apps et les route vers le serveur MCP approprié :

**Étapes de routage :**
1. Réception du message depuis l'iframe via `window.addEventListener('message')`
2. Validation de l'origine (doit correspondre à un iframe MCP App actif)
3. Extraction du JSON-RPC (méthode, paramètres, ID de requête)
4. Identification du serveur MCP associé à cet iframe
5. Envoi de la requête JSON-RPC au serveur via le transport approprié (SSE/stdio)
6. Réception de la réponse du serveur
7. Renvoi de la réponse à l'iframe via `postMessage`

**Logging et audit :**
- Tous les messages sont loggés dans `console.debug()` en mode développement
- Format : `[MCP] iframe → server: {method}` et `[MCP] server → iframe: {result}`

### MCPResourceBrowser - Interface utilisateur

Le navigateur de ressources MCP est accessible depuis :
1. **Settings modal** - Section dédiée "MCP Servers"
2. **Sidebar** - Bouton "MCP Resources" (optionnel)
3. **Chat input** - Bouton attach avec option "MCP Resource"

**Structure UI :**
```
MCP Resources
├─ Server: github-server (connected)
│  ├─ ui://pull-request-viewer
│  ├─ ui://diff-viewer
│  └─ ui://code-search
├─ Server: database-tools (connected)
│  └─ ui://query-builder
└─ Server: analytics (disconnected)
```

Chaque ressource est cliquable et ouvre le panneau d'artifact avec le rendu de la MCP App.

### Intégration avec le système d'artifacts existant

**Réutilisation maximale :**
- `ArtifactPanel` - Affiche les MCP Apps comme n'importe quel artifact
- `ArtifactPreview` - Route le type `mcp-app` vers `MCPAppPreview`
- `ContentBlock` - Nouveau type `MCPAppContentBlock` avec référence à l'artifact

**Nouveau composant : MCPAppPreview**

```typescript
function MCPAppPreview({ artifact }: { artifact: MCPAppArtifact }) {
  const { mcpResourceUri, mcpServerId, mcpToolData } = artifact;
  const [html, setHtml] = useState<string>('');

  useEffect(() => {
    // Charger le HTML de la ressource depuis le cache ou le serveur
    loadMCPResource(mcpServerId, mcpResourceUri).then(setHtml);
  }, [mcpResourceUri, mcpServerId]);

  useEffect(() => {
    // Configurer le bridge postMessage
    const bridge = new MCPMessageBridge(mcpServerId, iframeRef.current);

    // Passer les données d'outil à l'app si disponibles
    if (mcpToolData) {
      bridge.sendToApp({ type: 'toolData', data: mcpToolData });
    }

    return () => bridge.cleanup();
  }, [mcpServerId, mcpToolData]);

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-scripts allow-same-origin"
      referrerPolicy="no-referrer"
      srcDoc={html}
    />
  );
}
```

### Liaison outil → UI

Lorsqu'un outil MCP est invoqué avec une UI associée :

**Flux :**
1. L'assistant appelle un outil MCP (ex: `create_chart`)
2. Le serveur MCP exécute l'outil et retourne un résultat JSON
3. L'hôte vérifie si l'outil a une métadonnée `ui/resourceUri`
4. Si oui, un bouton "Voir dans Chart Viewer" est affiché à côté du résultat
5. Au clic, un `MCPAppArtifact` est créé avec :
   - `mcpResourceUri` = valeur de `ui/resourceUri`
   - `mcpToolData` = résultat de l'outil
6. Le panneau s'ouvre et la MCP App reçoit les données via postMessage

**Exemple de métadonnée d'outil :**
```json
{
  "name": "create_chart",
  "description": "Create a chart from data",
  "inputSchema": { ... },
  "metadata": {
    "ui/resourceUri": "ui://chart-viewer"
  }
}
```

### Sécurité

**Sandbox renforcé :**
- `allow-scripts` : Nécessaire pour l'exécution du code de l'app
- `allow-same-origin` : Nécessaire pour postMessage et stockage local de l'iframe
- **Refusé** : `allow-forms`, `allow-popups`, `allow-top-navigation`, `allow-downloads`

**Validation :**
- Origine des messages postMessage vérifiée systématiquement
- Rate limiting sur les messages (100/s max par iframe)
- Timeout sur les requêtes JSON-RPC (10s)
- Consentement utilisateur obligatoire pour `tools/call`

**Audit :**
- Tous les messages JSON-RPC loggés en développement
- Option "Inspect Code" disponible avant exécution
- Historique des invocations d'outils conservé

### Gestion du cycle de vie

**Connexion d'un serveur MCP :**
1. Utilisateur configure le serveur dans Settings
2. `MCPServerManager.connect(serverConfig)` établit la connexion
3. Requête JSON-RPC `initialize` envoyée au serveur
4. Serveur répond avec ses capacités
5. Requête `resources/list` pour récupérer les ressources `ui://`
6. Requête `tools/list` pour récupérer les outils disponibles
7. Statut passe à `connected`, ressources et outils stockés

**Déconnexion :**
1. Utilisateur clique sur "Disconnect" ou ferme l'application
2. Toutes les iframes MCP Apps de ce serveur sont fermées
3. Requête `shutdown` envoyée au serveur (si possible)
4. Connexion fermée proprement
5. Cache des ressources invalidé
6. Statut passe à `disconnected`

**Reconnexion automatique :**
- Si la connexion est perdue inopinément, retry avec backoff exponentiel
- Tentatives : 1s, 2s, 4s, 8s, 16s, 30s (puis toutes les 30s)
- Maximum 10 tentatives, puis arrêt et notification utilisateur

### Stockage et persistance

**localStorage :**
```typescript
// Clé: 'mcp_servers'
interface MCPServersConfig {
  servers: Array<{
    id: string;
    name: string;
    url?: string;      // Pour SSE
    command?: string;  // Pour stdio
  }>;
}
```

**Non persisté :**
- Credentials (API keys, tokens) - Saisie à chaque session ou via env vars
- Contenu des ressources UI - Rechargé depuis le serveur à chaque connexion
- Statut de connexion - Recalculé au démarrage

### Différences avec les artifacts classiques

| Aspect                  | Artifact classique      | MCP App                        |
|-------------------------|-------------------------|--------------------------------|
| **Source du contenu**   | Généré par l'assistant  | Serveur MCP externe            |
| **Type**                | code/html/react/etc.    | `mcp-app`                      |
| **Communication**       | Unidirectionnel         | Bidirectionnel (JSON-RPC)      |
| **Données dynamiques**  | Statique                | Peut charger des données       |
| **Sandbox**             | `allow-scripts`         | `allow-scripts allow-same-origin` |
| **Preview/Code toggle** | Oui                     | Oui                            |
| **Persistance**         | Stocké dans conversation| Référence au serveur + URI     |
| **Versioning**          | Oui (10 versions)       | Non (rechargé depuis serveur)  |

### Exemple de flux complet

**Scénario : Utilisateur ouvre un chart viewer après exécution d'un outil**

1. Assistant invoque `create_chart` sur serveur MCP "analytics"
2. Serveur retourne `{ data: [...], chartType: 'bar' }`
3. Hôte détecte `"ui/resourceUri": "ui://chart-viewer"` dans l'outil
4. Bouton "Voir dans Chart Viewer" affiché
5. Utilisateur clique → MCPAppArtifact créé
6. Panneau s'ouvre, `MCPAppPreview` rendu
7. Iframe chargée avec HTML de `ui://chart-viewer`
8. MCPMessageBridge configure le listener postMessage
9. Bridge envoie `{ type: 'toolData', data: { data: [...], chartType: 'bar' } }`
10. MCP App reçoit les données, affiche le graphique
11. Utilisateur interagit avec le graphique (zoom, filtre, etc.)
12. MCP App peut envoyer des requêtes JSON-RPC pour charger plus de données
13. Utilisateur ferme le panneau, iframe détruite, bridge nettoyé
