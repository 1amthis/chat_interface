import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_PENDING_CONVERSATION_TITLE,
  generateTitle,
  resolveGeneratedConversationTitle,
  sanitizeGeneratedConversationTitle,
  shouldAutoGenerateConversationTitle,
} from './conversation-title.ts';

test('sanitizeGeneratedConversationTitle trims wrappers, prefixes, and trailing punctuation', () => {
  const sanitized = sanitizeGeneratedConversationTitle('Title: "Deploy Next.js on Railway?"\nExtra line');
  assert.equal(sanitized, 'Deploy Next.js on Railway');
});

test('generateTitle falls back to the default placeholder for blank input', () => {
  assert.equal(generateTitle('   '), DEFAULT_PENDING_CONVERSATION_TITLE);
});

test('resolveGeneratedConversationTitle keeps acceptable AI titles', () => {
  const resolved = resolveGeneratedConversationTitle('Deploy Next.js on Railway', 'Need help deploying my Next.js app');
  assert.deepEqual(resolved, {
    title: 'Deploy Next.js on Railway',
    titleState: 'auto',
  });
});

test('resolveGeneratedConversationTitle falls back when the AI title is generic', () => {
  const resolved = resolveGeneratedConversationTitle('Help', 'Need help deploying my Next.js app to Railway');
  assert.deepEqual(resolved, {
    title: 'Need help deploying my...',
    titleState: 'fallback',
  });
});

test('shouldAutoGenerateConversationTitle only accepts pending conversations with both sides present', () => {
  assert.equal(shouldAutoGenerateConversationTitle({
    id: 'conv-1',
    title: 'New conversation',
    titleState: 'pending',
    messages: [
      { id: 'm1', role: 'user', content: 'How do I deploy this app?', timestamp: Date.now() },
      { id: 'm2', role: 'assistant', content: 'Start with your hosting target.', timestamp: Date.now() },
    ],
    provider: 'openai',
    model: 'gpt-5',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }), true);

  assert.equal(shouldAutoGenerateConversationTitle({
    id: 'conv-2',
    title: 'Existing title',
    messages: [
      { id: 'm1', role: 'user', content: 'How do I deploy this app?', timestamp: Date.now() },
      { id: 'm2', role: 'assistant', content: 'Start with your hosting target.', timestamp: Date.now() },
    ],
    provider: 'openai',
    model: 'gpt-5',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }), false);
});
