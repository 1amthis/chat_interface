# Artifacts — User Stories et Critères d'acceptation

## User Stories

### Affichage et interaction de base

- **US-ART-01** — En tant qu'utilisateur, je veux que les artifacts générés par l'assistant apparaissent comme des cartes dédiées dans le fil afin de les identifier et les ouvrir facilement.
- **US-ART-02** — En tant qu'utilisateur, je veux ouvrir un panneau de détail d'un artifact afin de le prévisualiser et d'accéder aux actions (copie, téléchargement, renommage).
- **US-ART-03** — En tant qu'utilisateur, je veux basculer entre un mode "Preview" et un mode "Code" pour certains types d'artifacts afin de voir soit le rendu soit la source.
- **US-ART-04** — En tant qu'utilisateur, je veux copier le contenu d'un artifact afin de le réutiliser rapidement.
- **US-ART-05** — En tant qu'utilisateur, je veux télécharger un artifact avec une extension cohérente (type/langage) afin de l'exporter localement.
- **US-ART-06** — En tant qu'utilisateur, je veux renommer un artifact afin de mieux le retrouver dans la conversation.
- **US-ART-07** — En tant qu'utilisateur, je veux redimensionner et fermer le panneau d'artifact afin d'adapter l'espace à mon besoin.
- **US-ART-08** — En tant qu'utilisateur, je veux retrouver les artifacts d'une conversation après rechargement afin de conserver l'historique et les exports.
- **US-ART-09** — En tant qu'utilisateur, je veux que les erreurs de rendu d'un artifact (diagramme/React) soient affichées proprement afin de comprendre quoi corriger.

### Versioning et historique

- **US-ART-10** — En tant qu'utilisateur, je veux accéder aux versions précédentes d'un artifact afin de consulter ou restaurer une version antérieure.
- **US-ART-11** — En tant qu'utilisateur, je veux voir l'historique des modifications d'un artifact afin de comprendre son évolution.
- **US-ART-12** — En tant qu'utilisateur, je veux basculer entre différentes versions d'un artifact afin de les comparer.

### Content Blocks et contenu enrichi

- **US-ART-13** — En tant qu'utilisateur, je veux que le texte avant et après un artifact soit préservé afin de conserver le contexte de l'assistant.
- **US-ART-14** — En tant qu'utilisateur, je veux voir le raisonnement de l'assistant (reasoning) dans une section dédiée afin de comprendre sa réflexion.
- **US-ART-15** — En tant qu'utilisateur, je veux voir les appels d'outils effectués par l'assistant afin de suivre les actions entreprises.
- **US-ART-16** — En tant qu'utilisateur, je veux que plusieurs artifacts dans un même message soient affichés dans le bon ordre afin de suivre la logique de l'assistant.

### Sécurité et robustesse

- **US-ART-17** — En tant qu'utilisateur, je veux que le code HTML/React généré soit isolé du reste de l'application afin d'éviter tout risque de sécurité.
- **US-ART-18** — En tant qu'utilisateur, je veux que le contenu SVG soit assaini afin d'éviter l'exécution de scripts malveillants.
- **US-ART-19** — En tant qu'utilisateur, je veux être informé si un artifact est trop volumineux afin de comprendre les limites du système.

### Accessibilité et responsive

- **US-ART-20** — En tant qu'utilisateur utilisant un lecteur d'écran, je veux naviguer efficacement entre les artifacts afin d'accéder au contenu.
- **US-ART-21** — En tant qu'utilisateur sur mobile, je veux que le panneau d'artifact s'adapte à mon écran afin d'avoir une expérience optimale.

---

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
```
