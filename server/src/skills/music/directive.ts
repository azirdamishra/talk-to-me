// Sends a directive outside the normal request/response cycle, via Alexa's
// Directive Service. This is what lets PlayIntent reply immediately with a
// spoken ack while search + stream extraction keep running in the
// background — the directive arrives once that work finishes, correlated to
// the still-open session by the original request's requestId. See
// STATUS.md's "The response-speed problem, and the fix".

import type { Directive } from 'ask-sdk-model';

export class DirectiveSendError extends Error {}

export async function sendDirective(
  apiEndpoint: string,
  apiAccessToken: string,
  requestId: string,
  directive: Directive,
): Promise<void> {
  const res = await fetch(`${apiEndpoint}/v1/directives`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ header: { requestId }, directive }),
  }).catch((error) => {
    throw new DirectiveSendError(`failed to send directive: ${error.message}`);
  });

  if (!res.ok) {
    throw new DirectiveSendError(`directive service responded with status ${res.status}`);
  }
}
