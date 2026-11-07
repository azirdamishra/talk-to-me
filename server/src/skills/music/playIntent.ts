import type { RequestHandler } from 'ask-sdk-core';
import { getIntentName, getRequestType, getSlotValue } from 'ask-sdk-core';
import { searchSong, YoutubeSearchError } from './youtube.js';
import { playInBackground } from './playback.js';
import { enqueue, getOrCreateUser, getPlaybackState, setCurrentTrack } from '../../db/queue.js';

// Search runs here, synchronously — a single YouTube Data API call is fast
// enough for Alexa's response window. Only stream extraction (spawning
// yt-dlp) is slow enough to need the background-ack-then-directive pattern,
// handled by playInBackground. See STATUS.md's "response-speed problem".
export const PlayIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    return (
      getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      getIntentName(handlerInput.requestEnvelope) === 'PlayIntent'
    );
  },
  async handle(handlerInput) {
    const song = getSlotValue(handlerInput.requestEnvelope, 'song');
    console.log(`PlayIntent song="${song}"`);

    if (!song) {
      return handlerInput.responseBuilder
        .speak('What would you like to hear?')
        .reprompt('What would you like to hear?')
        .getResponse();
    }

    const amazonUserId = handlerInput.requestEnvelope.context.System.user.userId;
    const userId = getOrCreateUser(amazonUserId);

    let result;
    try {
      result = await searchSong(song);
    } catch (error) {
      const message = error instanceof YoutubeSearchError ? error.message : String(error);
      console.error(`PlayIntent search failed: ${message}`);
      return handlerInput.responseBuilder
        .speak(`Sorry, I couldn't find a song called ${song}.`)
        .withShouldEndSession(true)
        .getResponse();
    }

    const { videoId, title } = result;
    const current = getPlaybackState(userId);

    if (current.videoId) {
      enqueue(userId, title, videoId);
      return handlerInput.responseBuilder.speak(`Added ${title} to your queue.`).withShouldEndSession(true).getResponse();
    }

    setCurrentTrack(userId, title, videoId);
    const { apiEndpoint, apiAccessToken } = handlerInput.requestEnvelope.context.System;
    const requestId = handlerInput.requestEnvelope.request.requestId;
    if (apiAccessToken) {
      playInBackground(apiEndpoint, apiAccessToken, requestId, videoId);
    }

    return handlerInput.responseBuilder.speak(`Playing ${title}.`).withShouldEndSession(true).getResponse();
  },
};
