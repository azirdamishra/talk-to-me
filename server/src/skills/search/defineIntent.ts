import type { RequestHandler } from 'ask-sdk-core';
import { getIntentName, getRequestType, getSlotValue } from 'ask-sdk-core';
import { defineWord } from './lookup.js';

export const DefineIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    return (
      getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      getIntentName(handlerInput.requestEnvelope) === 'DefineIntent'
    );
  },
  async handle(handlerInput) {
    const term = getSlotValue(handlerInput.requestEnvelope, 'term');
    console.log(`DefineIntent term="${term}"`);

    if (!term) {
      return handlerInput.responseBuilder
        .speak('What word would you like me to define?')
        .reprompt('What word would you like me to define?')
        .getResponse();
    }

    const definition = await defineWord(term);
    console.log(`DefineIntent speech="${definition}"`);
    return handlerInput.responseBuilder.speak(definition).withShouldEndSession(false).getResponse();
  },
};
