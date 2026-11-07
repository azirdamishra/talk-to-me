import type { Directive } from 'ask-sdk-model';
import { resolveStreamUrl, StreamResolutionError } from './ytdlp.js';
import { sendDirective } from './directive.js';

// Fire-and-forget by design: the caller has already replied to Alexa with a
// spoken ack before this runs, so there's no response left to attach a
// directive to — any failure here can only be logged, not spoken.
export function playInBackground(
  apiEndpoint: string,
  apiAccessToken: string,
  requestId: string,
  videoId: string,
  offsetMs = 0,
): void {
  void resolveStreamUrl(videoId)
    .then((url) => {
      const directive: Directive = {
        type: 'AudioPlayer.Play',
        playBehavior: 'REPLACE_ALL',
        audioItem: {
          stream: {
            token: videoId,
            url,
            offsetInMilliseconds: offsetMs,
          },
        },
      };
      return sendDirective(apiEndpoint, apiAccessToken, requestId, directive);
    })
    .catch((error: unknown) => {
      const message = error instanceof StreamResolutionError ? error.message : String(error);
      console.error(`playInBackground failed for videoId=${videoId}: ${message}`);
    });
}
