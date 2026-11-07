import { SkillBuilders } from 'ask-sdk-core';
import {
  CancelAndStopIntentHandler,
  ErrorHandler,
  FallbackIntentHandler,
  HelpIntentHandler,
  LaunchRequestHandler,
  SessionEndedRequestHandler,
} from './handlers.js';
import { DefineIntentHandler } from './defineIntent.js';
import { LookupIntentHandler } from './lookupIntent.js';

const skillBuilder = SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    DefineIntentHandler,
    LookupIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    FallbackIntentHandler,
    SessionEndedRequestHandler,
  )
  .addErrorHandlers(ErrorHandler);

// Pins requests to this specific skill's ID (from the Alexa Developer Console,
// set once the skill is created — see README). Without this, Alexa's signature
// verification alone would still accept a correctly-signed request sent by a
// *different* skill that someone else points at this same public endpoint.
if (process.env.ALEXA_SKILL_ID) {
  skillBuilder.withSkillId(process.env.ALEXA_SKILL_ID);
}

export const searchSkill = skillBuilder.create();
