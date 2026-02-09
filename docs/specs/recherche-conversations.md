# Recherche de conversations — Spécification fonctionnelle

## Contexte

L'application de chat accumule au fil du temps un grand nombre de conversations avec l'assistant. Les utilisateurs ont besoin de retrouver rapidement des échanges passés pour :

- Reprendre une conversation sur un sujet spécifique
- Retrouver une solution technique déjà discutée
- Consulter un artifact généré précédemment
- Naviguer efficacement dans leur historique

Actuellement, la sidebar affiche une liste linéaire de conversations triées par date, ce qui devient difficile à exploiter au-delà de quelques dizaines d'échanges. Une fonctionnalité de recherche permettrait de filtrer et retrouver instantanément les conversations pertinentes.

### Contraintes techniques

- Les conversations sont stockées en localStorage (limite ~5-10 MB)
- La recherche doit fonctionner entièrement côté client (pas de backend de recherche)
- La recherche doit rester performante avec plusieurs centaines de conversations
- L'interface doit rester responsive pendant la recherche

### Dépendances

- Système de stockage existant (`src/lib/storage.ts`)
- Composant Sidebar existant (`src/components/Sidebar.tsx`)
- Optionnel : réutilisation du module BM25 existant (`src/lib/memory-search/`)

---

## User Stories

### Recherche de base

- **US-SEARCH-01** — En tant qu'utilisateur, je veux rechercher dans mes conversations par mots-clés afin de retrouver rapidement un échange passé.

- **US-SEARCH-02** — En tant qu'utilisateur, je veux voir les résultats de recherche mis en évidence dans la liste afin d'identifier visuellement les correspondances.

- **US-SEARCH-03** — En tant qu'utilisateur, je veux voir un extrait du contexte de la correspondance afin de valider que c'est bien la conversation recherchée.

- **US-SEARCH-04** — En tant qu'utilisateur, je veux effacer ma recherche en un clic afin de revenir à la liste complète des conversations.

### Filtres et options

- **US-SEARCH-05** — En tant qu'utilisateur, je veux filtrer les résultats par projet afin de limiter la recherche à un contexte spécifique.

- **US-SEARCH-06** — En tant qu'utilisateur, je veux filtrer les résultats par période (aujourd'hui, cette semaine, ce mois, cette année) afin de cibler temporellement ma recherche.

- **US-SEARCH-07** — En tant qu'utilisateur, je veux rechercher uniquement dans les titres des conversations afin d'accélérer la recherche si je me souviens du sujet.

- **US-SEARCH-08** — En tant qu'utilisateur, je veux rechercher dans le contenu des messages afin de retrouver une conversation même si le titre n'est pas explicite.

### Performance et UX

- **US-SEARCH-09** — En tant qu'utilisateur, je veux que la recherche soit quasi-instantanée (<100ms) afin de ne pas interrompre mon flux de travail.

- **US-SEARCH-10** — En tant qu'utilisateur, je veux voir un indicateur de chargement si la recherche prend du temps afin de savoir que le système travaille.

- **US-SEARCH-11** — En tant qu'utilisateur, je veux que la recherche soit insensible à la casse et aux accents afin de trouver des résultats même avec une saisie approximative.

- **US-SEARCH-12** — En tant qu'utilisateur, je veux pouvoir naviguer dans les résultats au clavier (flèches haut/bas, Entrée) afin d'accéder rapidement à une conversation.

### Recherche avancée

- **US-SEARCH-13** — En tant qu'utilisateur, je veux rechercher dans les artifacts d'une conversation afin de retrouver du code ou du contenu généré.

- **US-SEARCH-14** — En tant qu'utilisateur, je veux voir le nombre de résultats trouvés afin d'évaluer la pertinence de ma requête.

- **US-SEARCH-15** — En tant qu'utilisateur, je veux que les résultats soient triés par pertinence (puis par date) afin de voir d'abord les correspondances les plus exactes.

### Raccourcis et accessibilité

- **US-SEARCH-16** — En tant qu'utilisateur, je veux ouvrir la recherche avec un raccourci clavier (Cmd/Ctrl+K ou Cmd/Ctrl+F) afin d'y accéder rapidement.

- **US-SEARCH-17** — En tant qu'utilisateur, je veux fermer la recherche avec Escape afin de revenir à l'état normal de la sidebar.

- **US-SEARCH-18** — En tant qu'utilisateur utilisant un lecteur d'écran, je veux que les résultats soient annoncés correctement afin de naviguer efficacement.

---

## Critères d'acceptation (Gherkin)

```gherkin
# language: fr

Fonctionnalité: Recherche de conversations dans la sidebar

  Scénario: Afficher le champ de recherche dans la sidebar
    Étant donné que la sidebar est visible
    Quand je regarde en haut de la liste des conversations
    Alors un champ de recherche avec placeholder "Rechercher..." est visible
    Et une icône de loupe est affichée dans le champ

  Scénario: Rechercher par mots-clés dans les titres
    Étant donné que j'ai 10 conversations dont 3 contiennent "React" dans le titre
    Quand je saisis "React" dans le champ de recherche
    Alors seules les 3 conversations contenant "React" sont affichées
    Et le mot "React" est mis en évidence dans les titres affichés

  Scénario: Rechercher dans le contenu des messages
    Étant donné que j'ai une conversation dont un message contient "useEffect hook"
    Et que le titre de cette conversation est "Questions JavaScript"
    Quand je saisis "useEffect" dans le champ de recherche
    Alors la conversation "Questions JavaScript" apparaît dans les résultats
    Et un extrait contenant "useEffect" est affiché sous le titre

  Scénario: Afficher un extrait de contexte pour chaque résultat
    Étant donné que je recherche "authentication"
    Et qu'une conversation contient "We need to implement JWT authentication for the API"
    Quand les résultats sont affichés
    Alors l'extrait "...implement JWT authentication for the..." est visible
    Et le mot "authentication" est mis en évidence dans l'extrait

  Scénario: Recherche insensible à la casse
    Étant donné que j'ai une conversation avec le titre "Configuration TypeScript"
    Quand je saisis "typescript" en minuscules
    Alors la conversation "Configuration TypeScript" apparaît dans les résultats

  Scénario: Recherche insensible aux accents
    Étant donné que j'ai une conversation avec le titre "Problème de sécurité"
    Quand je saisis "securite" sans accent
    Alors la conversation "Problème de sécurité" apparaît dans les résultats

  Scénario: Effacer la recherche
    Étant donné que j'ai saisi "React" dans le champ de recherche
    Et que 3 conversations sont affichées
    Quand je clique sur le bouton d'effacement (X) dans le champ
    Alors le champ de recherche est vidé
    Et toutes les conversations sont à nouveau affichées

  Scénario: Aucun résultat trouvé
    Étant donné que je recherche "xyznonexistent123"
    Et qu'aucune conversation ne contient ce terme
    Quand la recherche est effectuée
    Alors un message "Aucune conversation trouvée" est affiché
    Et une suggestion "Essayez avec d'autres mots-clés" est visible

  Scénario: Afficher le nombre de résultats
    Étant donné que je recherche "API"
    Et que 7 conversations correspondent
    Quand les résultats sont affichés
    Alors le texte "7 résultats" est visible au-dessus de la liste


Fonctionnalité: Filtres de recherche

  Scénario: Filtrer par projet
    Étant donné que j'ai 5 conversations dans le projet "Frontend"
    Et 3 conversations dans le projet "Backend"
    Et que je recherche "config"
    Quand je sélectionne le filtre projet "Frontend"
    Alors seules les conversations du projet "Frontend" contenant "config" sont affichées

  Scénario: Filtrer par période - Aujourd'hui
    Étant donné que j'ai des conversations créées aujourd'hui, hier et la semaine dernière
    Et que je recherche "test"
    Quand je sélectionne le filtre période "Aujourd'hui"
    Alors seules les conversations d'aujourd'hui contenant "test" sont affichées

  Scénario: Filtrer par période - Cette semaine
    Étant donné que j'ai des conversations des 7 derniers jours et plus anciennes
    Quand je sélectionne le filtre période "Cette semaine"
    Alors seules les conversations des 7 derniers jours sont affichées

  Scénario: Combiner plusieurs filtres
    Étant donné que je recherche "authentication"
    Et que je filtre par projet "Backend"
    Et que je filtre par période "Ce mois"
    Quand les résultats sont affichés
    Alors seules les conversations qui satisfont TOUS les critères sont affichées

  Scénario: Réinitialiser les filtres
    Étant donné que j'ai appliqué des filtres de projet et de période
    Quand je clique sur "Réinitialiser les filtres"
    Alors tous les filtres sont désactivés
    Et la recherche s'applique à toutes les conversations


Fonctionnalité: Recherche dans les artifacts

  Scénario: Trouver une conversation par le contenu d'un artifact
    Étant donné que j'ai une conversation avec un artifact de code contenant "fetchUserData"
    Quand je recherche "fetchUserData"
    Alors la conversation apparaît dans les résultats
    Et l'extrait indique que la correspondance est dans un artifact

  Scénario: Filtrer pour rechercher uniquement dans les artifacts
    Étant donné que j'active l'option "Rechercher dans les artifacts uniquement"
    Quand je saisis "useState"
    Alors seules les conversations avec des artifacts contenant "useState" sont affichées


Fonctionnalité: Performance et feedback

  Scénario: Recherche instantanée avec debounce
    Étant donné que j'ai 200 conversations
    Quand je saisis rapidement "test"
    Alors la recherche n'est exécutée qu'après 150ms sans frappe
    Et les résultats apparaissent en moins de 100ms après l'exécution

  Scénario: Indicateur de chargement pour recherches longues
    Étant donné que j'ai un très grand nombre de conversations
    Quand je lance une recherche qui prend plus de 200ms
    Alors un indicateur de chargement (spinner) est affiché
    Et l'indicateur disparaît quand les résultats sont prêts

  Scénario: Tri par pertinence
    Étant donné que je recherche "React"
    Et qu'une conversation a "React" dans le titre
    Et qu'une autre a "React" uniquement dans le contenu
    Quand les résultats sont affichés
    Alors la conversation avec "React" dans le titre apparaît en premier


Fonctionnalité: Navigation clavier

  Scénario: Ouvrir la recherche avec raccourci clavier
    Étant donné que je suis dans l'application
    Quand j'appuie sur Cmd+K (Mac) ou Ctrl+K (Windows/Linux)
    Alors le champ de recherche reçoit le focus
    Et je peux commencer à taper immédiatement

  Scénario: Naviguer dans les résultats au clavier
    Étant donné que j'ai des résultats de recherche affichés
    Et que le focus est dans le champ de recherche
    Quand j'appuie sur la flèche bas
    Alors le premier résultat est sélectionné visuellement
    Quand j'appuie à nouveau sur la flèche bas
    Alors le second résultat est sélectionné
    Quand j'appuie sur Entrée
    Alors la conversation sélectionnée s'ouvre

  Scénario: Fermer la recherche avec Escape
    Étant donné que le champ de recherche a le focus
    Et que j'ai saisi du texte
    Quand j'appuie sur Escape
    Alors le champ de recherche est vidé
    Et le focus est retiré du champ
    Et toutes les conversations sont affichées

  Scénario: Fermer la recherche avec Escape - champ vide
    Étant donné que le champ de recherche a le focus
    Et que le champ est vide
    Quand j'appuie sur Escape
    Alors le focus est retiré du champ de recherche


Fonctionnalité: Accessibilité

  Scénario: Annonce des résultats pour lecteur d'écran
    Étant donné que j'utilise un lecteur d'écran
    Quand je saisis une recherche et que les résultats s'affichent
    Alors le lecteur d'écran annonce "X résultats trouvés"

  Scénario: Labels ARIA appropriés
    Étant donné que j'examine le champ de recherche
    Alors il possède un attribut aria-label="Rechercher dans les conversations"
    Et les résultats sont dans une liste avec role="listbox"
    Et chaque résultat a role="option"

  Scénario: Focus visible sur les résultats
    Étant donné que je navigue au clavier dans les résultats
    Quand un résultat est sélectionné
    Alors un indicateur de focus visible est affiché
    Et le résultat sélectionné a aria-selected="true"


Fonctionnalité: Persistance et état

  Scénario: La recherche est conservée lors du changement de conversation
    Étant donné que j'ai saisi "React" dans la recherche
    Et que 3 résultats sont affichés
    Quand je clique sur un résultat pour ouvrir la conversation
    Alors la recherche "React" reste active dans le champ
    Et les 3 résultats restent visibles dans la sidebar

  Scénario: La recherche est effacée au rechargement
    Étant donné que j'ai une recherche active
    Quand je recharge la page
    Alors le champ de recherche est vide
    Et toutes les conversations sont affichées
```

---

## Contraintes techniques

### Algorithme de recherche

| Paramètre | Valeur |
|-----------|--------|
| Méthode de recherche | Recherche textuelle simple ou BM25 (réutilisation du module existant) |
| Debounce | 150ms après la dernière frappe |
| Temps de réponse cible | < 100ms pour 500 conversations |
| Normalisation | Lowercase + suppression des accents (NFD + regex) |

### Indexation

| Champs indexés | Poids suggéré |
|----------------|---------------|
| Titre de conversation | 3.0 |
| Premier message utilisateur | 2.0 |
| Contenu des messages | 1.0 |
| Contenu des artifacts | 0.8 |
| Titre des artifacts | 1.5 |

### Interface utilisateur

| Élément | Spécification |
|---------|---------------|
| Placeholder du champ | "Rechercher..." |
| Longueur max. extrait | 80 caractères |
| Nombre max. résultats affichés | 50 (avec scroll) |
| Highlight des correspondances | `<mark>` avec background jaune |

### Raccourcis clavier

| Action | Raccourci |
|--------|-----------|
| Focus sur recherche | `Cmd/Ctrl + K` ou `Cmd/Ctrl + F` |
| Naviguer résultats | `↑` / `↓` |
| Ouvrir conversation | `Enter` |
| Effacer/Fermer | `Escape` |

---

## Maquette textuelle

```
┌─────────────────────────────────────┐
│  🔍 Rechercher...              [X]  │
├─────────────────────────────────────┤
│  Filtres: [Projet ▼] [Période ▼]   │
│           3 résultats               │
├─────────────────────────────────────┤
│  ▸ Configuration **React** Native   │
│    "...utiliser **React** Native    │
│    pour le projet mobile..."        │
│    📁 Mobile App · il y a 2 jours   │
├─────────────────────────────────────┤
│  ▸ Tutoriel **React** Hooks         │
│    "...useState et useEffect dans   │
│    **React**..."                    │
│    📁 Frontend · il y a 1 semaine   │
├─────────────────────────────────────┤
│  ▸ Questions JavaScript             │
│    Artifact: "import **React**..."  │
│    📁 Général · il y a 2 semaines   │
└─────────────────────────────────────┘
```

---

## Notes d'implémentation

### Réutilisation du module memory-search

Le module `src/lib/memory-search/` existant (BM25, tokenizer, indexation) peut être adapté pour indexer les conversations. Différences principales :

- **Granularité** : Indexer par conversation (pas par message)
- **Champs multiples** : Titre, messages, artifacts avec poids différents
- **Temps réel** : Mise à jour de l'index à chaque nouvelle conversation/message

### Composants à créer/modifier

1. **`SearchInput.tsx`** — Champ de recherche avec debounce et raccourcis
2. **`SearchResults.tsx`** — Liste des résultats avec highlights
3. **`SearchFilters.tsx`** — Filtres projet/période
4. **`Sidebar.tsx`** — Intégration du système de recherche
5. **`src/lib/conversation-search/`** — Module de recherche dédié

### Stockage de l'index

- Option A : Index recalculé à chaque chargement (simple, pas de stockage supplémentaire)
- Option B : Index persisté en localStorage (plus rapide au démarrage, synchronisation requise)

Recommandation : Option A pour la v1, Option B si performance insuffisante.
