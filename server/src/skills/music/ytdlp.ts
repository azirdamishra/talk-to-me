// The unofficial half of the pipeline — see STATUS.md's "Known, honest
// caveats". yt-dlp does the actual extraction; this is just a thin,
// testable wrapper around invoking it.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const TIMEOUT_MS = 15000;

export class StreamResolutionError extends Error {}

export async function resolveStreamUrl(videoId: string): Promise<string> {
  const { stdout } = await execFileAsync(
    'yt-dlp',
    ['-f', 'bestaudio[ext=m4a]/bestaudio', '-g', `https://www.youtube.com/watch?v=${videoId}`],
    { timeout: TIMEOUT_MS },
  ).catch((error) => {
    throw new StreamResolutionError(`yt-dlp failed to resolve ${videoId}: ${error.message}`);
  });

  const url = stdout.trim();
  if (!url) {
    throw new StreamResolutionError(`yt-dlp returned no stream URL for ${videoId}`);
  }
  return url;
}
