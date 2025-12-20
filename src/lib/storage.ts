import { Conversation, ChatSettings, DEFAULT_MODELS, DEFAULT_SETTINGS, Folder, Project } from '@/types';
import { STORAGE_LIMITS } from './constants';

const CONVERSATIONS_KEY = 'chat_conversations';
const SETTINGS_KEY = 'chat_settings';
const FOLDERS_KEY = 'chat_folders';
const PROJECTS_KEY = 'chat_projects';
const MIGRATION_KEY = 'chat_migration_v1';

// Destructure storage limits for convenience
const { MAX_TOTAL_SIZE: MAX_STORAGE_SIZE, MAX_CONVERSATION_SIZE, MAX_CONVERSATIONS } = STORAGE_LIMITS;

/**
 * Migrate folders to projects (one-time migration)
 */
function migrateToProjects(): void {
  if (typeof window === 'undefined') return;

  // Check if already migrated
  const migrated = localStorage.getItem(MIGRATION_KEY);
  if (migrated === 'true') return;

  // Get legacy folders
  const foldersData = localStorage.getItem(FOLDERS_KEY);
  if (!foldersData) {
    localStorage.setItem(MIGRATION_KEY, 'true');
    return;
  }

  try {
    const folders = JSON.parse(foldersData);

    // Convert folders to projects (add empty instructions and files)
    const projects: Project[] = folders.map((folder: Folder) => ({
      ...folder,
      instructions: undefined,
      files: undefined,
    }));

    // Save as projects
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));

    // Migrate conversations: folderId -> projectId
    const conversationsData = localStorage.getItem(CONVERSATIONS_KEY);
    if (conversationsData) {
      const conversations: Conversation[] = JSON.parse(conversationsData);
      const updatedConversations = conversations.map(conv => {
        if (conv.folderId) {
          return {
            ...conv,
            projectId: conv.folderId,
          };
        }
        return conv;
      });
      localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(updatedConversations));
    }

    // Mark migration complete
    localStorage.setItem(MIGRATION_KEY, 'true');

    console.log(`[Migration] Migrated ${projects.length} folders to projects`);
  } catch (error) {
    console.error('[Migration] Failed to migrate folders:', error);
  }
}

export function getConversations(): Conversation[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(CONVERSATIONS_KEY);
  return data ? JSON.parse(data) : [];
}

/**
 * Calculate the size of a conversation in bytes
 */
function getConversationSize(conversation: Conversation): number {
  return new Blob([JSON.stringify(conversation)]).size;
}

/**
 * Calculate total size of all conversations
 */
function getTotalStorageSize(conversations: Conversation[]): number {
  return new Blob([JSON.stringify(conversations)]).size;
}

/**
 * Trim old conversations if we exceed limits
 */
function trimConversations(conversations: Conversation[]): Conversation[] {
  // Sort by last updated (most recent first)
  const sorted = [...conversations].sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  // Keep only MAX_CONVERSATIONS most recent
  let trimmed = sorted.slice(0, MAX_CONVERSATIONS);

  // Check total size and remove oldest if still too large
  while (trimmed.length > 1 && getTotalStorageSize(trimmed) > MAX_STORAGE_SIZE) {
    trimmed.pop(); // Remove oldest
    console.warn(`[Storage] Removed old conversation to stay under size limit`);
  }

  return trimmed;
}

/**
 * Compress a conversation by removing old messages if it's too large
 */
function compressConversation(conversation: Conversation): Conversation {
  const size = getConversationSize(conversation);

  if (size <= MAX_CONVERSATION_SIZE) {
    return conversation;
  }

  console.warn(`[Storage] Conversation "${conversation.title}" is ${Math.round(size / 1024)}KB, compressing...`);

  // Keep progressively fewer messages until under limit
  const messages = [...conversation.messages];
  let keepCount = Math.floor(messages.length / 2);
  let compressed = conversation;

  while (keepCount > 5 && getConversationSize(compressed) > MAX_CONVERSATION_SIZE) {
    const recentMessages = messages.slice(-keepCount);
    compressed = {
      ...conversation,
      messages: recentMessages,
    };
    keepCount = Math.floor(keepCount * 0.75);
  }

  const finalSize = getConversationSize(compressed);
  console.warn(`[Storage] Compressed to ${Math.round(finalSize / 1024)}KB (kept ${compressed.messages.length}/${conversation.messages.length} messages)`);

  return compressed;
}

export function saveConversation(conversation: Conversation): void {
  try {
    let conversations = getConversations();
    const index = conversations.findIndex((c) => c.id === conversation.id);

    // Compress conversation if it's too large
    const compressedConversation = compressConversation(conversation);

    if (index >= 0) {
      conversations[index] = compressedConversation;
    } else {
      conversations.unshift(compressedConversation);
    }

    // Trim conversations if we have too many or total size is too large
    conversations = trimConversations(conversations);

    // Try to save
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.error('[Storage] Quota exceeded, attempting emergency cleanup...');

      // Emergency: Keep only the current conversation and 5 most recent others
      try {
        const allConversations = getConversations();
        const currentConv = compressConversation(conversation);
        const otherConvs = allConversations
          .filter((c) => c.id !== conversation.id)
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 5)
          .map(compressConversation);

        const minimal = [currentConv, ...otherConvs];
        localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(minimal));

        console.warn(`[Storage] Emergency cleanup: Kept ${minimal.length} conversations`);

        // Show user-friendly error
        alert('Storage limit reached. Older conversations have been removed to save space. Consider exporting important conversations.');
      } catch (emergencyError) {
        console.error('[Storage] Emergency cleanup failed:', emergencyError);
        alert('Storage limit exceeded. Please clear some conversations manually or export them.');
        throw error;
      }
    } else {
      throw error;
    }
  }
}

export function deleteConversation(id: string): void {
  const conversations = getConversations().filter((c) => c.id !== id);
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
}

export function getSettings(): ChatSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  const data = localStorage.getItem(SETTINGS_KEY);
  const parsed = data ? (JSON.parse(data) as Partial<ChatSettings>) : {};
  const merged: ChatSettings = { ...DEFAULT_SETTINGS, ...parsed };

  const allowedModels = DEFAULT_MODELS[merged.provider];
  if (!allowedModels.includes(merged.model)) {
    return { ...merged, model: allowedModels[0] };
  }

  return merged;
}

export function saveSettings(settings: ChatSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// Project management
export function getProjects(): Project[] {
  if (typeof window === 'undefined') return [];

  // Run migration on first access
  migrateToProjects();

  const data = localStorage.getItem(PROJECTS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveProject(project: Project): void {
  const projects = getProjects();
  const index = projects.findIndex((p) => p.id === project.id);

  if (index >= 0) {
    projects[index] = project;
  } else {
    projects.push(project);
  }

  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function deleteProject(id: string): void {
  // Remove project
  const projects = getProjects().filter((p) => p.id !== id);
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));

  // Remove project reference from conversations
  const conversations = getConversations().map((c) =>
    c.projectId === id ? { ...c, projectId: undefined } : c
  );
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
}

export function updateConversationProject(conversationId: string, projectId: string | undefined): void {
  const conversations = getConversations();
  const index = conversations.findIndex((c) => c.id === conversationId);
  if (index >= 0) {
    conversations[index] = { ...conversations[index], projectId };
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
  }
}

// Legacy folder functions - kept for backward compatibility
/** @deprecated Use getProjects */
export function getFolders(): Folder[] {
  return getProjects();
}

/** @deprecated Use saveProject */
export function saveFolder(folder: Folder): void {
  saveProject(folder);
}

/** @deprecated Use deleteProject */
export function deleteFolder(id: string): void {
  deleteProject(id);
}

/** @deprecated Use updateConversationProject */
export function updateConversationFolder(conversationId: string, folderId: string | undefined): void {
  updateConversationProject(conversationId, folderId);
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateTitle(firstMessage: string): string {
  const maxLength = 30;
  const cleaned = firstMessage.replace(/\n/g, ' ').trim();
  return cleaned.length > maxLength ? cleaned.substring(0, maxLength) + '...' : cleaned;
}

/**
 * Get storage usage statistics
 */
export function getStorageStats(): {
  used: number;
  total: number;
  percentage: number;
  conversationCount: number;
  largestConversation: { id: string; title: string; size: number } | null;
} {
  const conversations = getConversations();
  const used = getTotalStorageSize(conversations);
  const total = MAX_STORAGE_SIZE;

  let largestConversation = null;
  let maxSize = 0;

  for (const conv of conversations) {
    const size = getConversationSize(conv);
    if (size > maxSize) {
      maxSize = size;
      largestConversation = {
        id: conv.id,
        title: conv.title,
        size,
      };
    }
  }

  return {
    used,
    total,
    percentage: (used / total) * 100,
    conversationCount: conversations.length,
    largestConversation,
  };
}

/**
 * Export a conversation as JSON for download
 */
export function exportConversation(conversationId: string): string {
  const conversations = getConversations();
  const conversation = conversations.find((c) => c.id === conversationId);
  if (!conversation) throw new Error('Conversation not found');

  return JSON.stringify(conversation, null, 2);
}

/**
 * Export all conversations as JSON for download
 */
export function exportAllConversations(): string {
  const conversations = getConversations();
  return JSON.stringify(conversations, null, 2);
}

/**
 * Import conversations from JSON
 */
export function importConversations(jsonData: string): void {
  try {
    const imported = JSON.parse(jsonData);
    const conversations = Array.isArray(imported) ? imported : [imported];

    const existing = getConversations();
    const merged = [...conversations, ...existing];

    // Remove duplicates (keep imported versions)
    const unique = merged.filter((conv, index, self) =>
      index === self.findIndex((c) => c.id === conv.id)
    );

    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(unique));
  } catch (error) {
    throw new Error('Invalid conversation data');
  }
}
