import { describe, expect, it, vi } from 'vitest';
import type { RequestEnvelope } from 'ask-sdk-model';

vi.mock('./lookup.js', () => ({
  defineWord: vi.fn(async (term: string) => `mock definition of ${term}`),
  lookupTopic: vi.fn(async (query: string) => `mock summary of ${query}`),
}));

const { searchSkill } = await import('./skill.js');

function minimalContext() {
  return { System: { application: { applicationId: 'test-app' } } };
}

function launchRequestEnvelope(): RequestEnvelope {
  return {
    version: '1.0',
    context: minimalContext(),
    request: { type: 'LaunchRequest', requestId: 'req-1', timestamp: new Date().toISOString() },
  } as unknown as RequestEnvelope;
}

function intentRequestEnvelope(
  intentName: string,
  slots: Record<string, string> = {},
): RequestEnvelope {
  return {
    version: '1.0',
    context: minimalContext(),
    request: {
      type: 'IntentRequest',
      requestId: 'req-2',
      timestamp: new Date().toISOString(),
      intent: {
        name: intentName,
        confirmationStatus: 'NONE',
        slots: Object.fromEntries(
          Object.entries(slots).map(([name, value]) => [
            name,
            { name, value, confirmationStatus: 'NONE' },
          ]),
        ),
      },
    },
  } as unknown as RequestEnvelope;
}

function speechOf(responseEnvelope: { response: { outputSpeech?: { ssml?: string; text?: string } } }) {
  const speech = responseEnvelope.response.outputSpeech;
  return speech?.ssml ?? speech?.text ?? '';
}

describe('searchSkill', () => {
  it('responds to LaunchRequest with help text', async () => {
    const result = await searchSkill.invoke(launchRequestEnvelope());
    expect(speechOf(result)).toMatch(/define a word/i);
  });

  it('responds to DefineIntent using the term slot', async () => {
    const result = await searchSkill.invoke(intentRequestEnvelope('DefineIntent', { term: 'osmosis' }));
    expect(speechOf(result)).toContain('mock definition of osmosis');
  });

  it('asks for a term when DefineIntent has no slot value', async () => {
    const result = await searchSkill.invoke(intentRequestEnvelope('DefineIntent', {}));
    expect(speechOf(result)).toMatch(/what word/i);
  });

  it('responds to LookupIntent using the query slot', async () => {
    const result = await searchSkill.invoke(
      intentRequestEnvelope('LookupIntent', { query: 'the Eiffel Tower' }),
    );
    expect(speechOf(result)).toContain('mock summary of the Eiffel Tower');
  });

  it('responds to AMAZON.HelpIntent', async () => {
    const result = await searchSkill.invoke(intentRequestEnvelope('AMAZON.HelpIntent'));
    expect(speechOf(result)).toMatch(/define a word/i);
  });

  it('ends the session on AMAZON.StopIntent', async () => {
    const result = await searchSkill.invoke(intentRequestEnvelope('AMAZON.StopIntent'));
    expect(result.response.shouldEndSession).toBe(true);
  });

  it('falls back gracefully on an unmatched intent name', async () => {
    const result = await searchSkill.invoke(intentRequestEnvelope('AMAZON.FallbackIntent'));
    expect(speechOf(result)).toMatch(/didn't catch that/i);
  });
});
