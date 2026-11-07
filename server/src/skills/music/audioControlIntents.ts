import type { RequestHandler } from 'ask-sdk-core';
import { getIntentName, getRequestType } from 'ask-sdk-core';
import { playInBackground } from './playback.js';
import { dequeueNext, getOrCreateUser, getPlaybackState, setCurrentTrack } from '../../db/queue.js';

function intentIs(handlerInput: Parameters<RequestHandler['canHandle']>[0], name: string): boolean {
  return (
    getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
    getIntentName(handlerInput.requestEnvelope) === name
  );
}

export const PauseIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    return intentIs(handlerInput, 'AMAZON.PauseIntent');
  },
  handle(handlerInput) {
    console.log('PauseIntent');
    return handlerInput.responseBuilder.addAudioPlayerStopDirective().withShouldEndSession(true).getResponse();
  },
};

export const ResumeIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    return intentIs(handlerInput, 'AMAZON.ResumeIntent');
  },
  handle(handlerInput) {
    console.log('ResumeIntent');
    const amazonUserId = handlerInput.requestEnvelope.context.System.user.userId;
    const userId = getOrCreateUser(amazonUserId);
    const current = getPlaybackState(userId);

    if (!current.videoId) {
      return handlerInput.responseBuilder.speak("There's nothing to resume.").withShouldEndSession(true).getResponse();
    }

    const { apiEndpoint, apiAccessToken } = handlerInput.requestEnvelope.context.System;
    const requestId = handlerInput.requestEnvelope.request.requestId;
    if (apiAccessToken) {
      playInBackground(apiEndpoint, apiAccessToken, requestId, current.videoId, current.offsetMs);
    }
    return handlerInput.responseBuilder.speak(`Resuming ${current.song}.`).withShouldEndSession(true).getResponse();
  },
};

export const NextIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    return intentIs(handlerInput, 'AMAZON.NextIntent');
  },
  handle(handlerInput) {
    console.log('NextIntent');
    const amazonUserId = handlerInput.requestEnvelope.context.System.user.userId;
    const userId = getOrCreateUser(amazonUserId);
    const next = dequeueNext(userId);

    if (!next) {
      return handlerInput.responseBuilder.speak('Your queue is empty.').withShouldEndSession(true).getResponse();
    }

    setCurrentTrack(userId, next.song, next.videoId);
    const { apiEndpoint, apiAccessToken } = handlerInput.requestEnvelope.context.System;
    const requestId = handlerInput.requestEnvelope.request.requestId;
    if (apiAccessToken) {
      playInBackground(apiEndpoint, apiAccessToken, requestId, next.videoId);
    }
    return handlerInput.responseBuilder.speak(`Playing ${next.song}.`).withShouldEndSession(true).getResponse();
  },
};

export const PreviousIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    return intentIs(handlerInput, 'AMAZON.PreviousIntent');
  },
  handle(handlerInput) {
    console.log('PreviousIntent');
    const amazonUserId = handlerInput.requestEnvelope.context.System.user.userId;
    const userId = getOrCreateUser(amazonUserId);
    const current = getPlaybackState(userId);

    if (!current.previousVideoId || !current.previousSong) {
      return handlerInput.responseBuilder.speak("There's nothing before this.").withShouldEndSession(true).getResponse();
    }

    setCurrentTrack(userId, current.previousSong, current.previousVideoId);
    const { apiEndpoint, apiAccessToken } = handlerInput.requestEnvelope.context.System;
    const requestId = handlerInput.requestEnvelope.request.requestId;
    if (apiAccessToken) {
      playInBackground(apiEndpoint, apiAccessToken, requestId, current.previousVideoId);
    }
    return handlerInput.responseBuilder
      .speak(`Playing ${current.previousSong}.`)
      .withShouldEndSession(true)
      .getResponse();
  },
};

export const CancelAndStopIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    return intentIs(handlerInput, 'AMAZON.CancelIntent') || intentIs(handlerInput, 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    console.log('Cancel/StopIntent');
    return handlerInput.responseBuilder
      .addAudioPlayerStopDirective()
      .speak('Goodbye!')
      .withShouldEndSession(true)
      .getResponse();
  },
};
