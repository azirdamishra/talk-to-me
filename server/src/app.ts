// Express app, no .listen() here — index.ts owns that — so tests can import
// `app` directly without binding a real port.
//
// No global body parser (e.g. express.json()): ask-sdk-express-adapter needs
// the raw request body itself to verify Alexa's signature chain, and applies
// its own scoped parsing per skill route after verification.

import express from 'express';
import { requestLogger } from './logger.js';
import { searchRouter } from './skills/search/route.js';
import { musicRouter } from './skills/music/route.js';

export const app = express();
app.use(requestLogger);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/skills/search', searchRouter);
app.use('/skills/music', musicRouter);
