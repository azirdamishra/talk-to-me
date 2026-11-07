// Verification is only meaningful against a real Alexa signature chain, so
// it's toggled off outside production — local curl testing and the handler
// tests below never need a real cert chain.

import { Router } from 'express';
import { ExpressAdapter } from 'ask-sdk-express-adapter';
import { searchSkill } from './skill.js';

const verify = process.env.NODE_ENV === 'production';
const adapter = new ExpressAdapter(searchSkill, verify, verify);

export const searchRouter = Router();
searchRouter.post('/', ...adapter.getRequestHandlers());
