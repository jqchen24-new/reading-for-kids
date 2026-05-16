# Story Theater

Interactive, read-aloud picture-book adventures for kids **about 7–9**. Pick a genre and hero, branch through scenes with **two choices** per beat, and hear each page with **natural neural TTS** (or your browser’s voice as fallback).

## Key features

- **AI story scenes** — Each beat is generated with **Claude** (Anthropic) using structured JSON so narration, choices, and cast data stay consistent. Stories honor prior choices and continuity across up to **16** scenes.
- **Read aloud** — Prefers **server-side neural TTS** (Gemini and/or OpenAI, configurable). Caches audio in the browser for faster replay and backtracks through the story without redoing every API call.
- **Sentence highlighting** — While audio plays, the active sentence is highlighted (including sensible handling of titles like `Mrs.`).
- **Scene illustrations** — Optional **Gemini** image generation per scene, with hero **reference images** on later beats so the main character stays recognizable (when enabled via env).
- **Picture-book UI** — Warm “page” layout, serif narration, and clear choice cards built with **React** + **Tailwind CSS v4**.
- **Production-ready API routes** — `POST /api/story`, `/api/tts`, `/api/illustration`, etc., compatible with **Vercel** serverless and the Vite dev middleware.
- **Analytics** — **Vercel Analytics** via `@vercel/analytics/react`; optional **Google Analytics** (gtag) can be added in `index.html`.

## Limitations (honest tradeoffs)

- **Latency** — New scene text, **neural TTS audio**, and **illustrations** are generated on demand. Expect a short wait while the server (and optional image API) finishes work; replay of cached beats is faster.
- **Neural TTS vs browser voice** — The app **prefers** server-side neural voices when `/api/tts` succeeds. You’ll hear **built-in browser speech** when neural TTS isn’t available — for example missing or inactive API keys, provider errors, quota or billing limits, or after the client backs off briefly following quota exhaustion (see `src/lib/ttsQuotaPause.js`). That fallback keeps the story readable aloud; it’s not the same quality as neural audio.

## Stack

| Area        | Tech                                      |
|------------|-------------------------------------------|
| Frontend   | React 19, Vite 8, Tailwind CSS 4          |
| Story AI   | Anthropic SDK (`messages` + JSON schema)  |
| Voice      | OpenAI / Google Gemini TTS (server-only)  |
| Art        | Gemini native image API (optional)        |
| Deploy     | Vercel (`vercel.json`, Node ≥ 20)         |

## Quick start

```bash
cd story-theater
cp .env.example .env   # then add keys — see below
npm install
npm run dev
```

Open the URL Vite prints (e.g. `http://localhost:5173`). Put `.env` **next to `package.json`** so both Vite and local API middleware load it.

### Required for full story mode

- **`ANTHROPIC_API_KEY`** — Powers `/api/story` (Claude).

### Optional

- **`GEMINI_API_KEY`** (or `GOOGLE_GENERATIVE_AI_API_KEY`) — TTS and/or illustrations.
- **`OPENAI_API_KEY`** — Alternative or fallback TTS provider.
- **`SCENE_ILLUSTRATIONS=1`** — Turn on per-scene pictures (see `.env.example`).

Full variable list and comments: **`.env.example`**.

## Scripts

| Command        | Purpose        |
|----------------|----------------|
| `npm run dev`   | Dev server + local API routes |
| `npm run build` | Production bundle (`dist/`)   |
| `npm run preview` | Serve `dist` locally       |
| `npm run lint`  | ESLint                        |

## License

Private project unless you add a license file.
