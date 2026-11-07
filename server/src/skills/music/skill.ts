import { SkillBuilders } from 'ask-sdk-core';
import {
  ErrorHandler,
  FallbackIntentHandler,
  HelpIntentHandler,
  LaunchRequestHandler,
  SessionEndedRequestHandler,
} from './handlers.js';
import { PlayIntentHandler } from './playIntent.js';
import {
  CancelAndStopIntentHandler,
  NextIntentHandler,
  PauseIntentHandler,
  PreviousIntentHandler,
  ResumeIntentHandler,
} from './audioControlIntents.js';
import { PlaybackOtherEventsHandler, PlaybackStoppedHandler } from './audioPlayerEvents.js';

const skillBuilder = SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    PlayIntentHandler,
    PauseIntentHandler,
    ResumeIntentHandler,
    NextIntentHandler,
    PreviousIntentHandler,
    CancelAndStopIntentHandler,
    HelpIntentHandler,
    FallbackIntentHandler,
    SessionEndedRequestHandler,
    PlaybackStoppedHandler,
    PlaybackOtherEventsHandler,
  )
  .addErrorHandlers(ErrorHandler);

// Pins requests to this specific skill's ID (from the Alexa Developer Console,
// set once the skill is created — see README). Without this, Alexa's signature
// verification alone would still accept a correctly-signed request sent by a
// *different* skill that someone else points at this same public endpoint.
// Named ALEXA_MUSIC_SKILL_ID, distinct from the search skill's
// ALEXA_SEARCH_SKILL_ID, because this is a second, separate Alexa skill sharing
// this same server process — each needs its own pin.
if (process.env.ALEXA_MUSIC_SKILL_ID) {
  skillBuilder.withSkillId(process.env.ALEXA_MUSIC_SKILL_ID);
}

export const musicSkill = skillBuilder.create();
