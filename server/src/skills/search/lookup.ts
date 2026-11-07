// Alexa-agnostic: plain string in, plain string out. Throws on failure —
// ErrorHandler is the single place that turns a failure into user-facing
// speech, so this file never needs to know about Alexa response shapes.

const USER_AGENT = 'alexa-hub/1.0 (contact: azirdamishra@gmail.com)';
const TIMEOUT_MS = 4000;

export class LookupError extends Error {}

export async function defineWord(word: string): Promise<string> {
  const res = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
    { signal: AbortSignal.timeout(TIMEOUT_MS) },
  ).catch(() => {
    throw new LookupError(`dictionary lookup failed for "${word}"`);
  });

  if (!res.ok) {
    throw new LookupError(`no definition found for "${word}" (status ${res.status})`);
  }

  const body = (await res.json()) as Array<{
    meanings?: Array<{ definitions?: Array<{ definition?: string }> }>;
  }>;

  const definition = body[0]?.meanings?.[0]?.definitions?.[0]?.definition;
  if (!definition) {
    throw new LookupError(`no definition found for "${word}"`);
  }

  return definition;
}

interface WikiSearchResponse {
  pages?: Array<{ key: string }>;
}

interface WikiSummaryResponse {
  type?: string;
  extract?: string;
}

export async function lookupTopic(query: string): Promise<string> {
  const searchRes = await fetch(
    `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=1`,
    { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) },
  ).catch(() => {
    throw new LookupError(`topic search failed for "${query}"`);
  });

  if (!searchRes.ok) {
    throw new LookupError(`topic search failed for "${query}" (status ${searchRes.status})`);
  }

  const searchBody = (await searchRes.json()) as WikiSearchResponse;
  const key = searchBody.pages?.[0]?.key;
  if (!key) {
    throw new LookupError(`couldn't find anything about "${query}"`);
  }

  const summaryRes = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(key)}`,
    { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) },
  ).catch(() => {
    throw new LookupError(`summary lookup failed for "${query}"`);
  });

  if (!summaryRes.ok) {
    throw new LookupError(`summary lookup failed for "${query}" (status ${summaryRes.status})`);
  }

  const summaryBody = (await summaryRes.json()) as WikiSummaryResponse;

  if (summaryBody.type === 'disambiguation') {
    return `There are multiple things called ${query}. Can you be more specific?`;
  }

  if (!summaryBody.extract) {
    throw new LookupError(`no summary found for "${query}"`);
  }

  return trimToSentences(summaryBody.extract, 2);
}

export function trimToSentences(text: string, count: number): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (!sentences || sentences.length === 0) {
    return text.trim();
  }
  return sentences
    .slice(0, count)
    .map((s) => s.trim())
    .join(' ');
}
