# Gestion des Artifacts — Spécifications fonctionnelles

## Vue d'ensemble

Cette spécification décrit le système de gestion des **artifacts** dans l'interface de chat. Les artifacts sont des blocs de contenu structurés (code, HTML, React, SVG, diagrammes, etc.) générés par l'assistant et affichés dans des cartes dédiées avec prévisualisation, versioning et actions (copie, téléchargement, renommage).

Le périmètre inclut également l'intégration **MCP Apps** (Model Context Protocol), permettant de connecter des serveurs externes exposant des ressources UI interactives.

## Documents

| Document | Description |
|----------|-------------|
| [01-artifacts-core.md](./01-artifacts-core.md) | User stories et critères d'acceptation pour les artifacts (affichage, versioning, preview, actions, accessibilité) |
| [02-mcp-apps.md](./02-mcp-apps.md) | User stories et critères d'acceptation pour l'intégration MCP Apps |
| [03-architecture-technique.md](./03-architecture-technique.md) | Contraintes techniques, structures de données, architecture MCP |

## Glossaire

### Termes généraux

| Terme | Définition |
|-------|------------|
| **Artifact** | Bloc de contenu généré par l'assistant (code, HTML, React, SVG, etc.) affiché dans une carte dédiée |
| **Content Block** | Unité structurelle d'un message (text, reasoning, tool_call, artifact) |
| **Artifact Panel** | Panneau latéral droit affichant le détail d'un artifact |
| **Preview Mode** | Mode d'affichage du rendu final d'un artifact (HTML, React, SVG, Mermaid, Markdown) |
| **Code Mode** | Mode d'affichage du code source brut d'un artifact |
| **Version** | Snapshot d'un artifact à un instant donné, conservé dans l'historique |
| **Sandbox** | Attribut HTML d'isolation de sécurité pour les iframes |
| **Streaming** | Réception progressive de la réponse de l'assistant en temps réel |
| **DOMPurify** | Bibliothèque de nettoyage/assainissement de contenu HTML/SVG |
| **Sucrase** | Transpileur JavaScript ultra-rapide pour convertir JSX en JS |
| **GFM** | GitHub Flavored Markdown, extension du format Markdown standard |

### Termes MCP Apps

| Terme | Définition |
|-------|------------|
| **MCP (Model Context Protocol)** | Protocole standard pour connecter des applications à des sources de données et outils externes |
| **MCP Server** | Serveur exposant des ressources, outils et prompts via le protocole MCP |
| **MCP App** | Interface utilisateur HTML interactive exposée par un serveur MCP via le schéma `ui://` |
| **ui:// URI** | Schéma d'URI spécial pour référencer des ressources UI pré-déclarées |
| **JSON-RPC** | Protocole d'appel de procédure à distance utilisé par MCP pour la communication |
| **postMessage** | API JavaScript permettant la communication inter-fenêtres (iframe ↔ parent) |
| **SSE (Server-Sent Events)** | Transport unidirectionnel serveur → client pour JSON-RPC |
| **stdio** | Transport bidirectionnel via entrée/sortie standard pour JSON-RPC |
| **MCPMessageBridge** | Composant routant les messages JSON-RPC entre iframes et serveurs MCP |
| **Pre-declared resource** | Ressource déclarée par le serveur MCP au démarrage (vs ressource dynamique) |
| **Tool metadata** | Métadonnées associées à un outil, incluant potentiellement `ui/resourceUri` |

## Compatibilité navigateurs

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
