# alexa-hub — search assistant skill

A headless Express + TypeScript service that backs a custom Alexa Skill:
"ask my assistant to define X" / "ask my assistant what is X". Runs as its
own process on the same Raspberry Pi as [Tend](https://github.com/azirdamishra/tend-tracker),
deliberately separate — Tend stays Tailscale-only, this service is exposed
publicly (via Tailscale Funnel) so Alexa's cloud can reach it.

A second skill (YouTube Music playback) is planned for a later phase, mounted
at `/skills/music` alongside this one on the same server — nothing here needs
to change when that's added.

## Run it locally

```bash
npm install
npm run dev          # tsx watch, http://localhost:3002
```

`GET /health` returns `{"ok":true}`. The skill itself is mounted at
`POST /skills/search` — this is what the Alexa Developer Console's endpoint
URL should point at once deployed (`https://<funnel-host>/skills/search`).

Signature/timestamp verification of incoming requests only runs when
`NODE_ENV=production`, so local testing (curl, or the test suite) never needs
a real Alexa signature chain.

## Test

```bash
npm run typecheck
npm test             # vitest — lookup.ts unit tests + skill handler tests
```

Handler tests invoke `searchSkill.invoke()` directly with fixture
`RequestEnvelope` JSON — no HTTP layer involved, since that layer
(`ask-sdk-express-adapter`) is Amazon's already-tested code.

## Build & deploy (the Pi)

```bash
npm run build         # compiles server/src -> server/dist
npm start              # node server/dist/index.js
```

See [`systemd/alexa-hub.service`](systemd/alexa-hub.service) for running it
as a service (auto-start on boot, auto-restart on crash), and
[`deploy.sh`](deploy.sh) for the `git pull && npm install && npm run build &&
systemctl restart` update flow — run it on the Pi itself (or via
`ssh pi@<host> './alexa-hub/deploy.sh'`).

## Interaction model

[`interaction-model/en-US.json`](interaction-model/en-US.json) and
[`interaction-model/en-IN.json`](interaction-model/en-IN.json) are the source
of truth for the skill's voice interface — identical content, one per locale,
matching how the Alexa console models multi-locale skills (each locale gets
its own tab and its own full model). Both are included from the start since
this skill is meant to work on an Echo registered to a US account (en-US) and
one registered to an India account (en-IN) — Amazon's docs warn that a device
with a different region/locale than the skill's model can't use it. Neither
file is served by the app; paste each into its matching locale tab in the
console's JSON Editor when creating the skill. Update `invocationName` in
both before creating the skill (keep them in sync); Amazon disallows names
containing "Alexa"/"Amazon"/"Echo" and generally requires 2+ words.

## Manual setup checklist (one-time, done by you — not automatable from here)

1. Create an Amazon developer account at developer.amazon.com (free).
2. On the Pi, once `alexa-hub` is deployed and running on port 3002:
   ```bash
   tailscale funnel 3002
   ```
   Confirm `https://<funnel-host>/health` returns `{"ok":true}` from outside
   your tailnet before touching the Alexa console.
3. In the Alexa Developer Console, create a new custom skill with a custom
   HTTPS endpoint (not Lambda) at `https://<funnel-host>/skills/search`. Add
   both the en-US and en-IN locales, and paste `interaction-model/en-US.json`
   / `interaction-model/en-IN.json` into each locale's JSON Editor tab.
4. Enable the skill for your account: Alexa app → Skills → Your Skills → Dev.
5. Copy the skill's **Skill ID** (on its Endpoint page in the console,
   starts `amzn1.ask.skill...`) into `ALEXA_SKILL_ID` in
   `systemd/alexa-hub.service`, then `sudo systemctl daemon-reload &&
   sudo systemctl restart alexa-hub` — see the Security section below for why.
6. (Later, optional) Invite a parent's Amazon account as a beta tester in the
   console so they can use it on their own Echo without their own server.

## Security — what stops a random request from the internet

This service is reachable from the public internet via Tailscale Funnel, so
by design *any* HTTPS client can send it a request. There's no way to
restrict Funnel to "only Alexa" at the network layer — Amazon doesn't publish
a stable IP range for Alexa's skill-invocation traffic, and even if it did,
IP allowlisting is exactly the kind of brittle defense Amazon's own security
model is designed to avoid. Instead, two things happen at the application
layer, in order, before any of this service's own logic (the dictionary/
Wikipedia calls) ever runs:

1. **Signature verification** (`ask-sdk-express-adapter`, active once
   `NODE_ENV=production`) — cryptographically checks that the request was
   signed by Amazon's Alexa service, using the certificate chain Amazon
   provides, and rejects anything else (forged, replayed, or just random
   junk) before it reaches any handler.
2. **Skill ID pinning** (`ALEXA_SKILL_ID` env var, checked in
   [`skill.ts`](server/src/skills/search/skill.ts)) — signature verification
   alone only proves a request came from *some* Alexa skill, not specifically
   this one. Anyone can create their own skill and point its endpoint at your
   Funnel URL; Amazon will then dutifully sign and send it real traffic. This
   check rejects any request whose `applicationId` isn't your skill's,
   so a request has to be both genuinely-Alexa *and* addressed to this exact
   skill to reach the handlers.

Two things worth knowing, not acted on by the code:
- **The Funnel hostname is not truly secret.** Funnel gets a real,
  publicly-trusted TLS certificate (that's exactly why Alexa accepts it), and
  certificate issuance is recorded in public Certificate Transparency logs —
  so the hostname can be found by anyone watching those logs, even if you
  never share the link. This is why the defenses above don't rely on the URL
  being unguessable.
- **Funnel only exposes the one port you declare** (`tailscale funnel 3002`)
  — nothing else on the Pi, including SSH or Tend's own port, becomes
  reachable through it.

## Project layout

```
server/src/
├── index.ts                 # .listen() only
├── app.ts                   # Express app — no global body parser (see below)
├── logger.ts                # request/response logging
└── skills/search/
    ├── route.ts              # ExpressAdapter wiring
    ├── skill.ts               # SkillBuilders.custom() registration
    ├── handlers.ts            # Launch/Help/Cancel/Stop/Fallback/SessionEnded/Error
    ├── defineIntent.ts        # "define X" — thin, delegates to lookup.ts
    ├── lookupIntent.ts        # "what is X" — thin, delegates to lookup.ts
    └── lookup.ts               # the only file with real logic: external API calls
```

`app.ts` never calls `express.json()` globally — `ask-sdk-express-adapter`
needs the raw request body to verify Alexa's signature chain, and applies its
own scoped body parsing per skill route after verification. A future
`/skills/music` route gets its own `ExpressAdapter` instance the same way.
