import { Message } from '@/types';

interface TreeMaps {
  byId: Map<string, Message>;
  children: Map<string | null, Message[]>; // parentId -> children sorted by timestamp
}

function buildTreeMaps(messages: Message[]): TreeMaps {
  const byId = new Map<string, Message>();
  const children = new Map<string | null, Message[]>();

  for (const msg of messages) {
    byId.set(msg.id, msg);
    const parentKey = msg.parentId ?? null;
    const siblings = children.get(parentKey);
    if (siblings) {
      siblings.push(msg);
    } else {
      children.set(parentKey, [msg]);
    }
  }

  // Sort each children list by timestamp
  for (const list of children.values()) {
    list.sort((a, b) => a.timestamp - b.timestamp);
  }

  return { byId, children };
}

/**
 * Walk from leaf to root via parentId, then reverse.
 * Legacy fast-path: if no message has parentId, return array as-is.
 */
export function getActivePath(messages: Message[], activeLeafId?: string): Message[] {
  if (messages.length === 0) return [];

  // Legacy fast-path: no branching metadata at all
  const hasBranching = messages.some(m => m.parentId !== undefined);
  if (!hasBranching) return messages;

  // If no activeLeafId specified, follow the first child at each level
  if (!activeLeafId) {
    return getPathFromRoot(messages);
  }

  const byId = new Map<string, Message>();
  for (const msg of messages) {
    byId.set(msg.id, msg);
  }

  const leaf = byId.get(activeLeafId);
  if (!leaf) {
    // activeLeafId doesn't exist (stale reference), fall back to default path
    return getPathFromRoot(messages);
  }

  // Walk up from leaf to root
  const path: Message[] = [];
  let current: Message | undefined = leaf;
  const visited = new Set<string>();

  while (current) {
    if (visited.has(current.id)) break; // cycle protection
    visited.add(current.id);
    path.push(current);
    if (current.parentId === null || current.parentId === undefined) break;
    current = byId.get(current.parentId);
  }

  path.reverse();
  return path;
}

/** Follow first (oldest) child at each level from root to build a default path. */
function getPathFromRoot(messages: Message[]): Message[] {
  const { children } = buildTreeMaps(messages);
  const path: Message[] = [];
  let parentKey: string | null = null;

  while (true) {
    const kids = children.get(parentKey);
    if (!kids || kids.length === 0) break;
    const first = kids[0];
    path.push(first);
    parentKey = first.id;
  }

  return path;
}

/**
 * Return siblings (messages sharing the same parentId) and the index of the given message.
 */
export function getSiblings(messages: Message[], messageId: string): { siblings: Message[]; index: number } {
  const { byId, children } = buildTreeMaps(messages);
  const msg = byId.get(messageId);
  if (!msg) return { siblings: [], index: -1 };

  const parentKey = msg.parentId ?? null;
  const siblings = children.get(parentKey) || [];
  const index = siblings.findIndex(m => m.id === messageId);

  return { siblings, index };
}

/**
 * Follow first (oldest) child at each level to the deepest leaf, starting from startId.
 * Returns the ID of the deepest leaf.
 */
export function getDefaultLeaf(messages: Message[], startId: string): string {
  const { children } = buildTreeMaps(messages);
  let currentId = startId;

  while (true) {
    const kids = children.get(currentId);
    if (!kids || kids.length === 0) break;
    currentId = kids[0].id;
  }

  return currentId;
}

/**
 * Lazy migration: assign parentId by array position for legacy conversations.
 * Idempotent - only sets parentId on messages that don't have it.
 */
export function ensureTreeStructure(messages: Message[]): Message[] {
  const hasBranching = messages.some(m => m.parentId !== undefined);
  if (hasBranching) return messages;

  // No branching metadata - assign parentId based on sequential order
  return messages.map((msg, idx) => ({
    ...msg,
    parentId: idx === 0 ? null : messages[idx - 1].id,
  }));
}

/**
 * Get all message IDs on the active path (for tree-aware compression).
 */
export function getActivePathIds(messages: Message[], activeLeafId?: string): Set<string> {
  const path = getActivePath(messages, activeLeafId);
  return new Set(path.map(m => m.id));
}
