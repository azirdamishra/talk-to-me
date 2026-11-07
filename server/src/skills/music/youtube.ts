// Alexa-agnostic: plain string in, plain result out. Throws on failure — the
// handler is the single place that turns a failure into user-facing speech.

const TIMEOUT_MS = 4000;

export class YoutubeSearchError extends Error {}

export interface SongResult {
  videoId: string;
  title: string;
}

interface YoutubeSearchResponse {
  items?: Array<{ id?: { videoId?: string }; snippet?: { title?: string } }>;
}

export async function searchSong(query: string): Promise<SongResult> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new YoutubeSearchError('YOUTUBE_API_KEY is not configured');
  }

  const url =
    'https://www.googleapis.com/youtube/v3/search' +
    `?part=snippet&type=video&maxResults=1&videoCategoryId=10` +
    `&q=${encodeURIComponent(query)}&key=${apiKey}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(() => {
    throw new YoutubeSearchError(`YouTube search failed for "${query}"`);
  });

  if (!res.ok) {
    throw new YoutubeSearchError(`YouTube search failed for "${query}" (status ${res.status})`);
  }

  const body = (await res.json()) as YoutubeSearchResponse;
  const item = body.items?.[0];
  const videoId = item?.id?.videoId;
  if (!videoId) {
    throw new YoutubeSearchError(`couldn't find a song matching "${query}"`);
  }

  return { videoId, title: item?.snippet?.title ?? query };
}
