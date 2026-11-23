# AGI Story · After Hours

**Snap a photo of any table and its real objects become a cast of 3D AI agents.** After the humans leave, they plot, whisper, ally and betray each other, and nobody (not even us) writes the ending. Every decision is shown on screen and in a live decision log, each object speaks in its own voice, and the cast remembers earlier tables, so the same photo never plays the same way twice.

Track 01 · Agent Animated Film

## How it works

1. **Snap**: take or upload a photo of the table (or use the backup demo table).
2. **Cast**: drag boxes around 3–5 objects. For each crop:
   - **Gemini** (vision) writes a character card: name, personality, voice, secret goal, skill, price, fun fact.
   - **Gemini (Hydrogen)** builds the **3D toy**: a body plus 2–10 primitive parts (lid, straw, screen, strap…) in the object's real colours, with the photo printed on the front, googly eyes and a talking mouth.
3. **Film**: the Narrator agent sets the opening ("Midnight. One charger left. The cleaner arrives at 6 AM."). Then 6 beats (`?beats=8` in the URL for a longer film): every object agent decides **in parallel** with one action out of `move_to · say · whisper · ally · betray · push · hide_behind · use_skill`, plus a one-sentence *why*. A Cinematographer agent picks each beat's shot.
4. **Voices**: **ElevenLabs** gives every object its own voice, plus the Narrator (browser speech is the fallback).
5. **Ending**: the Narrator decides the winner **only from the decision log**. Losers tip over, the winner gets confetti and a poster.
6. **Memory**: each run is saved (Bruin adapter + localStorage). Next run, every agent receives 2–3 rumors from earlier tables, and the audience interview verdict too, which changes their choices.

Every model call goes Gemini → Claude → offline mock, so the film never breaks; the casting cards and sponsor panel show which one actually ran.

## Run locally

```bash
npm install
cp .env.example .env     # add keys; anything missing falls back to a mock
npm run dev              # http://localhost:5173, the /api routes run inside Vite
```

The dev server also reads a `.env` in the parent folder.

## Deploy (Vercel)

Import the repo in Vercel and add the env vars from `.env.example`. `api/[route].ts` is a single serverless function serving every `/api/<route>`, so keys never reach the browser.

## Keys / providers

| Var | Used for |
| --- | --- |
| `GEMINI_API_KEY` (+ `GEMINI_API_KEY_1`) | AI Studio key(s), tried in order |
| `GOOGLE_GENAI_USE_VERTEXAI=true` | also try Vertex AI express mode with the same key |
| `GOOGLE_CLOUD_ACCESS_TOKEN` + `GOOGLE_CLOUD_PROJECT` + `GOOGLE_CLOUD_LOCATION` | Vertex AI with an OAuth token |
| `GEMINI_MODEL` | strong model: Narrator, casting, camera (e.g. `gemini-4-hydrogen`) |
| `GEMINI_3D_MODEL` | model that builds the 3D toys (defaults to `GEMINI_MODEL`) |
| `GEMINI_FAST_MODEL` | per-agent beats (defaults to `GEMINI_MODEL`) |
| `ANTHROPIC_API_KEY` | Claude backup brain: used automatically if Gemini fails (`CLAUDE_MODEL`, default `claude-opus-5-5`) |
| `ELEVENLABS_API_KEY` | per-character voices (uses your account's own voices) |
| `<SPONSOR>_API_URL` / `_API_KEY` | Bruin, BAND, AdaL, Finch, Telem, Glasser, Casuro adapters (`server/sponsors/`) |
| `RUNWARE_API_KEY` | poster image fallback |

The sponsor panel (bottom left) only turns a sponsor **green after a live call really succeeded**; grey means its mock ran.

## Layout

```
api/[route].ts         Vercel function → server/routes.ts
server/routes.ts       cast, model3d, beat, narrator, camera, voice, whisper, poster, memory, interview, status
server/gemini.ts       Gemini client (AI Studio + Vertex, JSON + image)
server/elevenlabs.ts   TTS
server/sponsors/       one adapter per sponsor, each with a mock
server/mockBrain.ts    offline agents so the film always plays
shared/                types + action validation (used by both sides)
src/film/              engine (beat loop), actions, memory, voice, store
src/scene/             Stage, ObjectActor, CameraRig, WhisperLines, Props
src/ui/                CastingScreen, DecisionLog, SponsorPanel, Credits
```
