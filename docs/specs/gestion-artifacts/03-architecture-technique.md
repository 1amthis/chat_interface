# Architecture Technique — Artifacts et MCP Apps

Ce document décrit les contraintes techniques, structures de données et détails d'implémentation pour le système d'artifacts et l'intégration MCP Apps.

---

## Contraintes techniques

### Taille et limites

| Paramètre | Valeur |
|-----------|--------|
| Taille maximale d'un artifact | 1 MB (1 048 576 octets) |
| Nombre maximal d'artifacts par message | Pas de limite stricte (recommandation : 5 max pour la performance) |
| Nombre de versions conservées par artifact | 10 versions max (FIFO) |
| Longueur maximale du titre | 200 caractères |
| Affichage du titre dans la carte | Tronqué à 50 caractères avec "..." |

### Dimensions du panneau

| Paramètre | Valeur |
|-----------|--------|
| Largeur par défaut | 40% de la fenêtre |
| Largeur minimale | 20% (ou 300px minimum absolu) |
| Largeur maximale | 80% |
| Breakpoint mobile | < 768px → panneau 100% (plein écran) |
| Breakpoint tablette | 768px - 1024px → panneau 60% par défaut |

### Timeouts et délais

| Paramètre | Valeur |
|-----------|--------|
| Timeout de chargement CDN React | 10 secondes |
| Délai d'affichage du feedback "Copied!" | 2 secondes |
| Debounce du redimensionnement | 16ms (60fps) |

### Sécurité

| Paramètre | Valeur |
|-----------|--------|
| Iframe sandbox pour HTML | `sandbox="allow-scripts"`, `referrerPolicy="no-referrer"` |
| Iframe sandbox pour React | `sandbox="allow-scripts"` |
| Assainissement SVG | DOMPurify avec profil SVG activé |
| Échappement des titres | Tous les caractères HTML spéciaux échappés |
| Validation noms de fichiers | Caractères invalides (`/`, `:`, `*`, `?`, `"`, `<`, `>`, `\|`) remplacés par `-` |

### Parsing des artifacts

| Paramètre | Valeur |
|-----------|--------|
| Format du tag | `<artifact type="..." title="..." language="...">contenu</artifact>` |
| Attributs requis | `type`, `title` |
| Attribut optionnel | `language` (pour type="code" uniquement) |
| Types valides | `code`, `html`, `react`, `markdown`, `svg`, `mermaid` |
| Génération d'ID | UUID v4 via `crypto.randomUUID()` |

### Dépendances externes

| Bibliothèque | Usage |
|--------------|-------|
| React/ReactDOM 18 | CDN unpkg.com, preview React |
| Sucrase | Transpilation JSX → JS |
| DOMPurify | Assainissement SVG |
| Prism | Coloration syntaxique du code |
| Mermaid | Rendu des diagrammes |
| ReactMarkdown | Rendu Markdown avec plugin GFM |

### Stockage (localStorage)

| Paramètre | Valeur |
|-----------|--------|
| Clé de stockage | `conversations` (contient tous les messages et artifacts) |
| Format | JSON stringifié |
| Limite navigateur | ~5-10 MB selon le navigateur |
| Backup | Aucun backup automatique |

### Performance

- **Rendu différé** : Les iframes ne sont rendus que lorsque le panneau est ouvert
- **Optimisation React** : `useMemo` pour éviter le re-wrapping du HTML
- **Virtualisation** : Non implémentée (peut être ajoutée pour de longues listes d'artifacts)

---

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

---

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

type ArtifactType = 'code' | 'html' | 'react' | 'markdown' | 'svg' | 'mermaid';
```

---

## Mapping des extensions de fichiers

Pour le téléchargement, les extensions sont déterminées ainsi :

### Par type d'artifact

| Type | Extension |
|------|-----------|
| `code` | `.txt` (sauf si `language` est défini) |
| `html` | `.html` |
| `react` | `.jsx` |
| `markdown` | `.md` |
| `svg` | `.svg` |
| `mermaid` | `.mmd` |

### Par langage (pour type="code")

| Langage | Extension |
|---------|-----------|
| `javascript` | `.js` |
| `typescript` | `.ts` |
| `python` | `.py` |
| `java` | `.java` |
| `cpp` | `.cpp` |
| `c` | `.c` |
| `csharp` | `.cs` |
| `go` | `.go` |
| `rust` | `.rs` |
| `ruby` | `.rb` |
| `php` | `.php` |
| `swift` | `.swift` |
| `kotlin` | `.kt` |
| `sql` | `.sql` |

---

## Badges de type

Chaque type d'artifact a un badge coloré :

| Type | Light Mode | Dark Mode |
|------|------------|-----------|
| **Code** | `bg-blue-100 text-blue-800` | `bg-blue-900 text-blue-200` |
| **HTML** | `bg-pink-100 text-pink-800` | `bg-pink-900 text-pink-200` |
| **React** | `bg-cyan-100 text-cyan-800` | `bg-cyan-900 text-cyan-200` |
| **Markdown** | `bg-purple-100 text-purple-800` | `bg-purple-900 text-purple-200` |
| **SVG** | `bg-yellow-100 text-yellow-800` | `bg-yellow-900 text-yellow-200` |
| **Mermaid** | `bg-green-100 text-green-800` | `bg-green-900 text-green-200` |

Tous les badges doivent respecter un ratio de contraste WCAG AA minimum (4.5:1).

---

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

---

## Architecture MCP Apps

### Vue d'ensemble

L'intégration MCP Apps s'appuie sur l'infrastructure d'artifacts existante. Une MCP App est essentiellement un artifact de type spécial (`mcp-app`) dont le contenu HTML provient d'un serveur MCP externe plutôt que d'être généré par l'assistant.

**Composants principaux :**

| Composant | Responsabilité |
|-----------|----------------|
| **MCPServerManager** | Gère les connexions aux serveurs MCP |
| **MCPResourceBrowser** | UI pour naviguer dans les ressources `ui://` disponibles |
| **MCPAppPreview** | Renderer pour les MCP Apps (extension de HTMLPreview) |
| **MCPMessageBridge** | Routeur JSON-RPC entre iframes et serveurs MCP |

### Contraintes MCP

#### Connexion et serveurs

| Paramètre | Valeur |
|-----------|--------|
| Protocole de communication | JSON-RPC 2.0 sur transport SSE ou stdio |
| Nombre maximal de serveurs connectés | Pas de limite (recommandation : 5 max) |
| Timeout de connexion | 10 secondes |
| Reconnexion automatique | Oui, backoff exponentiel (1s, 2s, 4s, 8s, max 30s) |
| Heartbeat/ping | Toutes les 30 secondes |

#### Ressources UI (ui://)

| Paramètre | Valeur |
|-----------|--------|
| Schéma URI | `ui://template-name` |
| Type MIME supporté | `text/html` exclusivement (v1.0) |
| Taille maximale d'une ressource UI | 500 KB (512 000 octets) |
| Cache des ressources | En mémoire, invalidé à la déconnexion |
| Nombre maximal de ressources UI par serveur | 50 |

#### Communication JSON-RPC via postMessage

| Paramètre | Valeur |
|-----------|--------|
| Timeout de requête JSON-RPC | 10 secondes |
| Validation de l'origine | Obligatoire |
| Audit logging | Console en mode développement |
| Rate limiting | 100 messages/seconde max par iframe |
| Taille maximale d'un message | 1 MB |

#### Sécurité et sandbox

| Paramètre | Valeur |
|-----------|--------|
| Iframe sandbox pour MCP Apps | `sandbox="allow-scripts allow-same-origin"`, `referrerPolicy="no-referrer"` |
| Permissions refusées | `allow-forms`, `allow-popups`, `allow-top-navigation`, `allow-downloads` |
| Consentement utilisateur | Requis pour toute invocation d'outil via `tools/call` |
| Inspection pré-exécution | Onglet "Code" disponible |

#### Métadonnées et liaison outils ↔ UI

| Paramètre | Valeur |
|-----------|--------|
| Métadonnée standard | `"ui/resourceUri": "ui://template-name"` |
| Passage de données | Via postMessage JSON-RPC avec `resources/read` |
| Format des données | JSON arbitraire, validé côté MCP App |

#### Fallbacks et compatibilité

| Paramètre | Valeur |
|-----------|--------|
| Fallback obligatoire | Tous les outils MCP doivent fournir un résultat textuel |
| Version MCP minimale | 1.0 (SEP-1865) |
| Rétrocompatibilité | Serveurs sans support UI pleinement fonctionnels |

#### Stockage

| Paramètre | Valeur |
|-----------|--------|
| Clé localStorage | `mcp_servers` |
| Format | `{ serverId, url, name, status }[]` |
| Credentials | Non stockés (env vars ou saisie par session) |

#### Gestion d'erreurs

| Paramètre | Valeur |
|-----------|--------|
| Timeout de chargement de ressource | 10 secondes |
| Retry automatique | Non (manuel uniquement) |
| Erreurs JSON-RPC | Code + message descriptif renvoyé à l'app |
| Crash de l'iframe | Détecté, rechargée avec avertissement |

### Structures de données MCP

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

| Aspect | Artifact classique | MCP App |
|--------|-------------------|---------|
| **Source du contenu** | Généré par l'assistant | Serveur MCP externe |
| **Type** | code/html/react/etc. | `mcp-app` |
| **Communication** | Unidirectionnel | Bidirectionnel (JSON-RPC) |
| **Données dynamiques** | Statique | Peut charger des données |
| **Sandbox** | `allow-scripts` | `allow-scripts allow-same-origin` |
| **Preview/Code toggle** | Oui | Oui |
| **Persistance** | Stocké dans conversation | Référence au serveur + URI |
| **Versioning** | Oui (10 versions) | Non (rechargé depuis serveur) |

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
