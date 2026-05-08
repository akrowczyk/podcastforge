# PodcastForge

> NotebookLM-style podcast generator on the xAI Grok stack.
> Vite + React + Express. v0.1 — P0/P1 scaffold (skeleton + working TTS pipeline).

## What's in this build

- **P0 — Skeleton**: Vite/React app, Express proxy, Tailwind w/ Grok-style black/white theme, Zustand project store, three routed screens (Source / Editor / Render).
- **P1 — TTS pipeline**: `/api/tts` proxy, `/api/generate-script` proxy, browser-side Web Audio decode + lamejs MP3 encode, per-turn synthesis with concurrency cap of 4, configurable inter-turn pauses, per-turn preview, full episode render with download.

## Project layout

```
podcastforge/
├── client/                  # Vite + React SPA
│   ├── src/
│   │   ├── routes/          # SourceScreen / EditorScreen / RenderScreen
│   │   ├── components/      # TurnCard, VoicePicker, HealthBadge
│   │   ├── store/           # Zustand project store (persists to localStorage)
│   │   ├── lib/
│   │   │   ├── audio/       # decode, render, encodeMp3
│   │   │   ├── grokClient.ts
│   │   │   └── pMap.ts
│   │   └── styles/index.css
│   ├── tailwind.config.js
│   └── vite.config.ts       # proxies /api → http://localhost:8787
├── server/                  # Express proxy (keeps API key server-side)
│   └── src/
│       ├── routes/          # generateScript / tts / health
│       ├── prompts/         # builder.ts — production prompts
│       └── lib/             # xaiClient.ts, rateLimit.ts
├── shared/types.ts          # one source of truth for both sides
├── .env.example
└── README.md
```

## Quick start

### 1. Get an xAI API key
Sign up at https://x.ai/api, create a key, copy it.

### 2. Configure env
```bash
cp .env.example .env
# Edit .env — paste XAI_API_KEY
```

### 3. Install + run server
```bash
cd server
npm install
npm run dev    # listens on :8787
```

### 4. Install + run client (separate terminal)
```bash
cd client
npm install
npm run dev    # opens http://localhost:5173
```

The client's Vite dev server proxies `/api/*` to the server, so you only browse to `:5173`.

### 5. Smoke test
- Open `http://localhost:5173`
- Header shows a green "online" dot if the server has the API key
- Paste any article (≥ 200 chars) into the source box
- Click **Generate Script** — should land you on the editor with ~30 turns
- Click **▶ Preview** on any turn to hear that single line
- Click **Render Audio →** then **Render Episode** — watch turn statuses tick to green
- **↓ Download MP3** to grab the file

## What's stubbed in v0.1 (these come in P2-P7)

- PDF/DOCX/URL ingestion (today: paste-only)
- Per-turn regenerate-via-LLM (today: per-turn audio re-render only)
- Add/duplicate/delete/reorder turns
- Project export/import as `.json`
- Tag linter (warns when LLM over-tags)
- Web Worker for MP3 encoding (today: encodes on main thread — fine for short episodes)
- Custom voice cloning UI

## Cost reference

- **Script generation** (grok-4.3): ~$0.05 per ~10-min episode
- **TTS** (Grok TTS): $4.20 per 1M characters → ~$0.06 per ~10-min episode
- **Total per episode**: ~$0.11

## Architecture notes

- **All API key handling is server-side.** The client never touches the xAI key. This is also why TTS goes through `/api/tts` rather than the browser hitting xAI directly.
- **Per-turn synthesis is mandatory** because Grok TTS only renders one voice per request, and per-turn caching means edits only re-render what changed.
- **State persists to localStorage** (script + config + source text), but blob URLs do not — re-render after a reload.
- **Concurrency is capped at 4** parallel TTS calls to respect rate limits and keep UI responsive.

## Design system

The aesthetic is intentional Grok-stack monochrome:
- Pure black `#0A0A0A` ground, white `#FAFAFA` ink, neutral gray scale between
- Typography pairs Inter Tight (display) with JetBrains Mono (labels/metadata)
- Hairline borders (1px), generous whitespace, no rounded corners except progress bars
- Single accent color (`#FF3B00` signal red) reserved for in-flight progress only
- Subtle film-grain overlay across the whole app for texture (3% opacity)
- Tabular nums for all numeric metadata

## License

Private / not yet public.
