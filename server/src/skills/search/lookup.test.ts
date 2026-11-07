import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { defineWord, lookupTopic, trimToSentences, LookupError } from './lookup.js';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response;
}

describe('trimToSentences', () => {
  it('keeps only the requested number of sentences', () => {
    const text = 'First sentence. Second sentence! Third sentence? Fourth.';
    expect(trimToSentences(text, 2)).toBe('First sentence. Second sentence!');
  });

  it('returns the trimmed text as-is when there is no sentence punctuation', () => {
    expect(trimToSentences('no punctuation here', 2)).toBe('no punctuation here');
  });
});

describe('defineWord', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the first definition found', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse([{ meanings: [{ definitions: [{ definition: 'a greeting' }] }] }]),
    );
    await expect(defineWord('hello')).resolves.toBe('a greeting');
  });

  it('throws a LookupError when the API responds with a non-2xx status', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(null, false, 404));
    await expect(defineWord('asdfqwerty')).rejects.toBeInstanceOf(LookupError);
  });

  it('throws a LookupError when the response has no definition', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([{ meanings: [] }]));
    await expect(defineWord('hello')).rejects.toBeInstanceOf(LookupError);
  });

  it('throws a LookupError when the fetch itself fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));
    await expect(defineWord('hello')).rejects.toBeInstanceOf(LookupError);
  });
});

describe('lookupTopic', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('searches then summarizes, trimmed to sentences', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ pages: [{ key: 'Photosynthesis' }] }))
      .mockResolvedValueOnce(
        jsonResponse({ extract: 'Sentence one. Sentence two. Sentence three.' }),
      );
    await expect(lookupTopic('photosynthesis')).resolves.toBe('Sentence one. Sentence two.');
  });

  it('returns a clarification message for disambiguation pages', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ pages: [{ key: 'Mercury' }] }))
      .mockResolvedValueOnce(jsonResponse({ type: 'disambiguation', extract: 'Mercury may refer to...' }));
    await expect(lookupTopic('mercury')).resolves.toMatch(/multiple things called mercury/i);
  });

  it('throws a LookupError when search finds nothing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ pages: [] }));
    await expect(lookupTopic('asdfqwerty')).rejects.toBeInstanceOf(LookupError);
  });
});
