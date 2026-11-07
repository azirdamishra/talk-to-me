import type { ErrorHandler as AskErrorHandler, RequestHandler } from 'ask-sdk-core';
import { getIntentName, getRequestType } from 'ask-sdk-core';

const HELP_SPEECH =
  'You can ask me to define a word, or ask what something is. For example, ' +
  'try "define photosynthesis" or "what is the Eiffel Tower".';

export const LaunchRequestHandler: RequestHandler = {
  canHandle(handlerInput) {
    return getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
  },
  handle(handlerInput) {
    console.log('LaunchRequest');
    return handlerInput.responseBuilder
      .speak(HELP_SPEECH)
      .reprompt('What would you like to know?')
      .getResponse();
  },
};

export const HelpIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    return (
      getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent'
    );
  },
  handle(handlerInput) {
    console.log('HelpIntent');
    return handlerInput.responseBuilder
      .speak(HELP_SPEECH)
      .reprompt('What would you like to know?')
      .getResponse();
  },
};

export const CancelAndStopIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    return (
      getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      (getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent' ||
        getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent')
    );
  },
  handle(handlerInput) {
    console.log('Cancel/StopIntent');
    return handlerInput.responseBuilder.speak('Goodbye!').withShouldEndSession(true).getResponse();
  },
};

export const FallbackIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    return (
      getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent'
    );
  },
  handle(handlerInput) {
    console.log('FallbackIntent');
    return handlerInput.responseBuilder
      .speak("Sorry, I didn't catch that. " + HELP_SPEECH)
      .reprompt('What would you like to know?')
      .getResponse();
  },
};

export const SessionEndedRequestHandler: RequestHandler = {
  canHandle(handlerInput) {
    return getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    const reason = request.type === 'SessionEndedRequest' ? request.reason : 'unknown';
    console.log(`SessionEndedRequest reason=${reason}`);
    return handlerInput.responseBuilder.getResponse();
  },
};

export const ErrorHandler: AskErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.error('Unhandled error:', error);
    return handlerInput.responseBuilder
      .speak('Sorry, I had trouble with that. Please try again.')
      .reprompt('What would you like to know?')
      .getResponse();
  },
};
