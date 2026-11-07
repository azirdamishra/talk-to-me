import { describe, expect, it, vi } from 'vitest';
import type { RequestEnvelope } from 'ask-sdk-model';

process.env.DB_PATH = ':memory:';

vi.mock('./youtube.js', () => ({
  searchSong: vi.fn(async (query: string) => ({ videoId: `vid-${query}`, title: `mock title for ${query}` })),
  YoutubeSearchError: class YoutubeSearchError extends Error {},
}));
vi.mock('./playback.js', () => ({
  playInBackground: vi.fn(),
}));

const { musicSkill } = await import('./skill.js');

function minimalContext(userId = 'amzn1.account.TEST') {
  return {
    System: {
      application: { applicationId: 'test-app' },
      user: { userId },
      apiEndpoint: 'https://api.amazonalexa.com',
      apiAccessToken: 'test-token',
    },
  };
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
  userId = 'amzn1.account.TEST',
): RequestEnvelope {
  return {
    version: '1.0',
    context: minimalContext(userId),
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

describe('musicSkill', () => {
  it('responds to LaunchRequest with help text', async () => {
    const result = await musicSkill.invoke(launchRequestEnvelope());
    expect(speechOf(result)).toMatch(/play a song/i);
  });

  it('plays the requested song immediately when nothing is already playing', async () => {
    const result = await musicSkill.invoke(
      intentRequestEnvelope('PlayIntent', { song: 'superstition' }, 'amzn1.account.PLAY1'),
    );
    expect(speechOf(result)).toContain('Playing mock title for superstition');
    expect(result.response.directives).toBeUndefined();
  });

  it('queues the song instead of interrupting when something is already playing', async () => {
    const userId = 'amzn1.account.PLAY2';
    await musicSkill.invoke(intentRequestEnvelope('PlayIntent', { song: 'first song' }, userId));
    const result = await musicSkill.invoke(intentRequestEnvelope('PlayIntent', { song: 'second song' }, userId));
    expect(speechOf(result)).toContain('Added mock title for second song to your queue');
  });

  it('asks for a song when PlayIntent has no slot value', async () => {
    const result = await musicSkill.invoke(intentRequestEnvelope('PlayIntent', {}));
    expect(speechOf(result)).toMatch(/what would you like to hear/i);
  });

  it('plays the next queued song on AMAZON.NextIntent', async () => {
    const userId = 'amzn1.account.NEXT1';
    await musicSkill.invoke(intentRequestEnvelope('PlayIntent', { song: 'first song' }, userId));
    await musicSkill.invoke(intentRequestEnvelope('PlayIntent', { song: 'second song' }, userId));
    const result = await musicSkill.invoke(intentRequestEnvelope('AMAZON.NextIntent', {}, userId));
    expect(speechOf(result)).toContain('Playing mock title for second song');
  });

  it('reports an empty queue on AMAZON.NextIntent with nothing queued', async () => {
    const result = await musicSkill.invoke(
      intentRequestEnvelope('AMAZON.NextIntent', {}, 'amzn1.account.NEXT2'),
    );
    expect(speechOf(result)).toMatch(/queue is empty/i);
  });

  it('issues an AudioPlayer.Stop directive on AMAZON.PauseIntent', async () => {
    const result = await musicSkill.invoke(intentRequestEnvelope('AMAZON.PauseIntent'));
    expect(result.response.directives?.[0]?.type).toBe('AudioPlayer.Stop');
  });

  it('ends the session on AMAZON.StopIntent', async () => {
    const result = await musicSkill.invoke(intentRequestEnvelope('AMAZON.StopIntent'));
    expect(result.response.shouldEndSession).toBe(true);
  });

  it('acknowledges AudioPlayer.PlaybackStarted with an empty response', async () => {
    const envelope = {
      version: '1.0',
      context: minimalContext(),
      request: {
        type: 'AudioPlayer.PlaybackStarted',
        requestId: 'req-3',
        timestamp: new Date().toISOString(),
        offsetInMilliseconds: 0,
        token: 'vid-x',
      },
    } as unknown as RequestEnvelope;
    const result = await musicSkill.invoke(envelope);
    expect(result.response.outputSpeech).toBeUndefined();
  });

  it('falls back gracefully on an unmatched intent name', async () => {
    const result = await musicSkill.invoke(intentRequestEnvelope('AMAZON.FallbackIntent'));
    expect(speechOf(result)).toMatch(/didn't catch that/i);
  });
});
