import type { RequestHandler } from 'ask-sdk-core';
import { getRequestType } from 'ask-sdk-core';
import { getOrCreateUser, setPlaybackOffset } from '../../db/queue.js';

// These arrive as their own request type (AudioPlayer.*), not IntentRequest
// — Alexa's AudioPlayer sends them directly as playback state changes, with
// no voice input involved. None of them need to say anything back; an empty
// response is the correct reply.
function audioPlayerRequestType(
  handlerInput: Parameters<RequestHandler['canHandle']>[0],
): string | undefined {
  const type = getRequestType(handlerInput.requestEnvelope);
  return type.startsWith('AudioPlayer.') ? type : undefined;
}

export const PlaybackStoppedHandler: RequestHandler = {
  canHandle(handlerInput) {
    return audioPlayerRequestType(handlerInput) === 'AudioPlayer.PlaybackStopped';
  },
  handle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    const offsetMs = request.type === 'AudioPlayer.PlaybackStopped' ? request.offsetInMilliseconds ?? 0 : 0;
    const amazonUserId = handlerInput.requestEnvelope.context.System.user.userId;
    const userId = getOrCreateUser(amazonUserId);
    console.log(`AudioPlayer.PlaybackStopped offsetMs=${offsetMs}`);
    setPlaybackOffset(userId, offsetMs);
    return handlerInput.responseBuilder.getResponse();
  },
};

export const PlaybackOtherEventsHandler: RequestHandler = {
  canHandle(handlerInput) {
    const type = audioPlayerRequestType(handlerInput);
    return (
      type === 'AudioPlayer.PlaybackStarted' ||
      type === 'AudioPlayer.PlaybackNearlyFinished' ||
      type === 'AudioPlayer.PlaybackFinished' ||
      type === 'AudioPlayer.PlaybackFailed'
    );
  },
  handle(handlerInput) {
    console.log(`${audioPlayerRequestType(handlerInput)}`);
    return handlerInput.responseBuilder.getResponse();
  },
};
