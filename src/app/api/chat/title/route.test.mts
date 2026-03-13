import assert from 'node:assert/strict';
import test from 'node:test';

import { handleTitleRequest } from './route.ts';
import { DEFAULT_SETTINGS } from '../../../../types/index.ts';

function createRequest(body: Record<string, unknown>, includeOrigin = true): Request {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (includeOrigin) {
    headers.origin = 'http://localhost:3000';
  }

  return new Request('http://localhost:3000/api/chat/title', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

test('handleTitleRequest rejects requests that fail CSRF validation', async () => {
  const response = await handleTitleRequest(createRequest({}, false));
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'CSRF validation failed' });
});

test('handleTitleRequest returns 400 when the provider API key is missing', async () => {
  const response = await handleTitleRequest(createRequest({
    settings: {
      ...DEFAULT_SETTINGS,
      provider: 'openai',
      model: 'gpt-5',
      openaiKey: undefined,
    },
    userMessage: 'How do I deploy this app?',
  }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'API key is required' });
});

test('handleTitleRequest sanitizes the generated title before returning it', async () => {
  const response = await handleTitleRequest(
    createRequest({
      settings: {
        ...DEFAULT_SETTINGS,
        provider: 'openai',
        model: 'gpt-5',
        openaiKey: 'test-key',
      },
      userMessage: 'How do I deploy this app?',
    }),
    {
      generateConversationTitle: async () => 'Title: "Deploy Next.js on Railway?"',
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { title: 'Deploy Next.js on Railway' });
});
