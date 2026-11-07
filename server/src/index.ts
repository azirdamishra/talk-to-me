import { app } from './app.js';

const PORT = Number(process.env.PORT) || 3002;

app.listen(PORT, () => {
  console.log(`alexa-hub listening on http://localhost:${PORT}`);
});
