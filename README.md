# alexa-hub — search assistant + music skills

A headless Express + TypeScript service backing two custom Alexa Skills,
sharing one process:

- **Search assistant** — "ask my assistant to define X" / "ask my assistant
  what is X", mounted at `/skills/search`.
- **Music player** — "ask my music to play X", streaming audio pulled from
  YouTube through Alexa's built-in `AudioPlayer` interface, mounted at
  `/skills/music`.

Each is registered as its own separate skill in the Alexa Developer Console
(own invocation name, own Skill ID) — they just happen to share this one
server/process/deploy, per the structural slot reserved for this from the
start (see "Project layout" below).

Runs as its own process on the same Raspberry Pi as [Tend](https://github.com/azirdamishra/tend-tracker),
deliberately separate — Tend stays Tailscale-only, this service is exposed
publicly (via Tailscale Funnel) so Alexa's cloud can reach it.

## Run it locally

```bash
npm install
npm run dev          # tsx watch, http://localhost:3002
```

`GET /health` returns `{"ok":true}`. The two skills are mounted at
`POST /skills/search` and `POST /skills/music` — these are what each
skill's Alexa Developer Console endpoint URL should point at once deployed
(`https://<funnel-host>/skills/search`, `https://<funnel-host>/skills/music`).

The music skill additionally needs:
- `YOUTUBE_API_KEY` — a YouTube Data API v3 key (Google Cloud Console, free
  tier is enough at this traffic volume), used to search for songs.
- `yt-dlp` installed and on `PATH` — used to resolve a direct, playable
  audio stream URL from the search result. Not an npm dependency; install it
  separately (`pip install yt-dlp` or your platform's package manager).

Signature/timestamp verification of incoming requests only runs when
`NODE_ENV=production`, so local testing (curl, or the test suite) never needs
a real Alexa signature chain.

## Test

```bash
npm run typecheck
npm test             # vitest — both skills' unit tests + handler tests
```

Handler tests invoke `searchSkill.invoke()` / `musicSkill.invoke()` directly
with fixture `RequestEnvelope` JSON — no HTTP layer involved, since that
layer (`ask-sdk-express-adapter`) is Amazon's already-tested code.

## How the music skill's playback works

1. `PlayIntent` searches the song via the YouTube Data API (fast, done
   synchronously within Alexa's response window).
2. The handler replies immediately with a short spoken ack ("Playing X")
   while, in the background, `yt-dlp` resolves a direct audio URL for that
   video — extraction is the slow part and would blow Alexa's ~8s response
   budget if done inline.
3. Once the URL is ready, the server sends a follow-up `AudioPlayer.Play`
   directive via Alexa's Directive Service (`skills/music/directive.ts`),
   correlated to the live session by the original request's `requestId`.
   Alexa's own AudioPlayer then streams the audio directly from YouTube's
   CDN to the Echo — this server never proxies or stores audio bytes.

Each Amazon account gets its own queue and playback position (SQLite,
`server/src/db/`), so you and a parent don't step on each other's
"next"/"previous" on the music skill.

**Known, honest caveat:** pulling audio via `yt-dlp` is unofficial — YouTube
doesn't sanction it, same legal/gray-area territory as an ad-blocker. Fine
for personal use, not something to publish or monetize. `yt-dlp` also
occasionally breaks when YouTube changes something server-side; the project
patches quickly, so the fix is almost always "update the dependency."

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
2. Get a `YOUTUBE_API_KEY` from the Google Cloud Console (enable the YouTube
   Data API v3 on a project, create an API key) and install `yt-dlp` on the
   Pi, confirmed on `PATH` for the service user (`sudo -u pi yt-dlp
   --version`) — both needed for the music skill.
3. On the Pi, once `alexa-hub` is deployed and running on port 3002:
   ```bash
   tailscale funnel 3002
   ```
   Confirm `https://<funnel-host>/health` returns `{"ok":true}` from outside
   your tailnet before touching the Alexa console.
4. In the Alexa Developer Console, create **two** custom skills (each its
   own invocation name and Skill ID, both pointing at this one Funnel host):
   - **Search assistant** — custom HTTPS endpoint at
     `https://<funnel-host>/skills/search`. Add both the en-US and en-IN
     locales, pasting `interaction-model/en-US.json` /
     `interaction-model/en-IN.json` into each locale's JSON Editor tab.
   - **Music player** — custom HTTPS endpoint at
     `https://<funnel-host>/skills/music`. Turn on the **Audio Player**
     interface under the Interfaces tab. Add both locales, pasting
     `interaction-model/music-en-US.json` /
     `interaction-model/music-en-IN.json`.
5. Enable both skills for your account: Alexa app → Skills → Your Skills →
   Dev.
6. Copy each skill's **Skill ID** (on its Endpoint page in the console,
   starts `amzn1.ask.skill...`) into the matching variable in
   `systemd/alexa-hub.service` (`ALEXA_SEARCH_SKILL_ID` for search,
   `ALEXA_MUSIC_SKILL_ID` for music), then `sudo systemctl daemon-reload &&
   sudo systemctl restart alexa-hub` — see the Security section below for why.
7. (Later, optional) Invite a parent's Amazon account as a beta tester in the
   console, for either or both skills, so they can use them on their own
   Echo without their own server.

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
2. **Skill ID pinning** (`ALEXA_SEARCH_SKILL_ID` for the search skill,
   `ALEXA_MUSIC_SKILL_ID` for the music skill — each checked in that skill's
   own `skill.ts`) — signature verification alone only proves a request came
   from *some* Alexa skill, not specifically this one. Anyone can create
   their own skill and point its endpoint at your Funnel URL; Amazon will
   then dutifully sign and send it real traffic. This check rejects any
   request whose `applicationId` isn't that skill's own, so a request has to
   be both genuinely-Alexa *and* addressed to that exact skill to reach its
   handlers. The two skills are pinned independently since they're separate
   Alexa skills sharing this one process.

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
├── index.ts                      # .listen() only
├── app.ts                        # Express app — no global body parser (see below)
├── logger.ts                     # request/response logging
├── db/                            # music skill's shared state
│   ├── schema.ts                   # better-sqlite3 connection + table creation
│   └── queue.ts                    # users / queue / playback_state queries
├── skills/search/
│   ├── route.ts                    # ExpressAdapter wiring
│   ├── skill.ts                     # SkillBuilders.custom() registration
│   ├── handlers.ts                  # Launch/Help/Cancel/Stop/Fallback/SessionEnded/Error
│   ├── defineIntent.ts              # "define X" — thin, delegates to lookup.ts
│   ├── lookupIntent.ts              # "what is X" — thin, delegates to lookup.ts
│   └── lookup.ts                     # the only file with real logic: external API calls
└── skills/music/
    ├── route.ts                    # its own ExpressAdapter instance
    ├── skill.ts                     # its own SkillBuilders.custom() registration
    ├── handlers.ts                  # Launch/Help/Fallback/SessionEnded/Error
    ├── playIntent.ts                # "play X" — search, enqueue-or-play
    ├── audioControlIntents.ts       # Pause/Resume/Next/Previous/Cancel/Stop
    ├── audioPlayerEvents.ts         # AudioPlayer.* request handlers
    ├── youtube.ts                   # YouTube Data API search
    ├── ytdlp.ts                     # yt-dlp wrapper — resolves a stream URL
    ├── directive.ts                 # out-of-band Directive Service POST
    └── playback.ts                   # ties ytdlp + directive together in the background
```

`app.ts` never calls `express.json()` globally — `ask-sdk-express-adapter`
needs the raw request body to verify Alexa's signature chain, and each
skill's route applies its own scoped body parsing after verification, via
its own `ExpressAdapter` instance. This is why the two skills can share one
process without one's body parsing interfering with the other's.
