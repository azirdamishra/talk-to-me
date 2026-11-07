import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { searchSong, YoutubeSearchError } from './youtube.js';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response;
}

describe('searchSong', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    process.env.YOUTUBE_API_KEY = 'test-key';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.YOUTUBE_API_KEY;
  });

  it('returns the top result', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ items: [{ id: { videoId: 'abc123' }, snippet: { title: 'Superstition' } }] }),
    );
    await expect(searchSong('superstition')).resolves.toEqual({
      videoId: 'abc123',
      title: 'Superstition',
    });
  });

  it('throws when YOUTUBE_API_KEY is not configured', async () => {
    delete process.env.YOUTUBE_API_KEY;
    await expect(searchSong('superstition')).rejects.toBeInstanceOf(YoutubeSearchError);
  });

  it('throws a YoutubeSearchError when the API responds with a non-2xx status', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(null, false, 403));
    await expect(searchSong('superstition')).rejects.toBeInstanceOf(YoutubeSearchError);
  });

  it('throws a YoutubeSearchError when there are no results', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ items: [] }));
    await expect(searchSong('asdfqwerty')).rejects.toBeInstanceOf(YoutubeSearchError);
  });

  it('throws a YoutubeSearchError when the fetch itself fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));
    await expect(searchSong('superstition')).rejects.toBeInstanceOf(YoutubeSearchError);
  });
});
