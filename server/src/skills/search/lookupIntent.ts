import type { RequestHandler } from 'ask-sdk-core';
import { getIntentName, getRequestType, getSlotValue } from 'ask-sdk-core';
import { lookupTopic } from './lookup.js';

export const LookupIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    return (
      getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      getIntentName(handlerInput.requestEnvelope) === 'LookupIntent'
    );
  },
  async handle(handlerInput) {
    const query = getSlotValue(handlerInput.requestEnvelope, 'query');
    console.log(`LookupIntent query="${query}"`);

    if (!query) {
      return handlerInput.responseBuilder
        .speak('What would you like to know about?')
        .reprompt('What would you like to know about?')
        .getResponse();
    }

    const summary = await lookupTopic(query);
    console.log(`LookupIntent speech="${summary}"`);
    return handlerInput.responseBuilder.speak(summary).withShouldEndSession(false).getResponse();
  },
};
