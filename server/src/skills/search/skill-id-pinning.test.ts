import { describe, expect, it, vi } from 'vitest';
import type { RequestEnvelope } from 'ask-sdk-model';

// Separate test file because skill.ts reads process.env.ALEXA_SEARCH_SKILL_ID at
// import time — setting it here, then importing, gives this file its own
// pinned searchSkill instance without affecting search-skill.test.ts.
vi.mock('./lookup.js', () => ({
  defineWord: vi.fn(async (term: string) => `mock definition of ${term}`),
  lookupTopic: vi.fn(async (query: string) => `mock summary of ${query}`),
}));

process.env.ALEXA_SEARCH_SKILL_ID = 'amzn1.ask.skill.the-real-skill-id';
const { searchSkill } = await import('./skill.js');

function launchRequestEnvelope(applicationId: string): RequestEnvelope {
  return {
    version: '1.0',
    context: { System: { application: { applicationId } } },
    request: { type: 'LaunchRequest', requestId: 'req-1', timestamp: new Date().toISOString() },
  } as unknown as RequestEnvelope;
}

describe('skill ID pinning', () => {
  it('serves a request whose applicationId matches ALEXA_SEARCH_SKILL_ID', async () => {
    const result = await searchSkill.invoke(launchRequestEnvelope('amzn1.ask.skill.the-real-skill-id'));
    expect(result.response.outputSpeech).toBeDefined();
  });

  it('rejects a request whose applicationId does not match', async () => {
    await expect(
      searchSkill.invoke(launchRequestEnvelope('amzn1.ask.skill.someone-elses-skill')),
    ).rejects.toThrow();
  });
});
