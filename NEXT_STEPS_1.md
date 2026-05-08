# PodcastForge — Next Steps for Claude Code

> Working brief for picking up the v0.1 codebase and shipping P2 through P7.
> Read this end-to-end before writing any code. The order matters.

---

## How to use this file

This file is the source of truth for what's next. When you start a Claude Code session in this repo:

1. Read this file in full.
2. Read `README.md` for the architecture overview.
3. Read `PodcastForge_Build_Plan_v0.1.docx` (in the repo root or sibling folder) — the v0.1 spec doc has the prompt engineering reasoning and Grok API reference you'll need when the work touches LLM calls or TTS.
4. Pick **one phase** from the roadmap below. Do not spread work across phases — finish one before starting the next. Each phase below has a definition of done.
5. After every meaningful change, run `npm run typecheck` (client) and `npm run typecheck` (server). Don't trust "looks fine" — TS 5.x's ArrayBuffer strictness has bitten this codebase before.
6. Before declaring a phase done, run the smoke test in the "Smoke Test Protocol" section at the bottom.

---

## Current State (v0.1 — P0/P1 shipped)

**What works end-to-end:**
- Vite/React SPA at `:5173` with three routed screens (Source / Editor / Render)
- Express proxy at `:8787` — keeps the xAI API key server-side
- `/api/generate-script` calls Grok 4.3 with production prompts (two-host or solo), returns parsed JSON
- `/api/tts` proxies Grok TTS, returns raw MP3 bytes
- Per-turn audio synthesis with concurrency cap of 4
- Per-turn preview (▶ button on each editor card)
- Web Audio decode → trailing-silence trim → lamejs MP3 encode → single downloadable file
- Configurable inter-turn pauses (250 ms speaker-switch / 150 ms same-speaker)
- Project state persists to localStorage (Zustand `persist` middleware)
- Black/white Grok aesthetic with Inter Tight + JetBrains Mono, 3% film-grain overlay

**What's stubbed, listed by phase below.**

**Known constraints to respect:**
- Server uses ESM (`"type": "module"` in all three `package.json` files: server, client, shared)
- Cross-package imports use `.js` extension on `.ts` source files (ESM convention)
- TS 5.7 strict — `Float32Array` and `Uint8Array` need `<ArrayBuffer>` casts when handing to Web Audio APIs and `Blob` constructors. There are existing examples in `client/src/lib/audio/decode.ts` and `encodeMp3.ts`.
- The `shared/` folder has its own `package.json` for ESM resolution. Don't remove it.
- All TTS calls are per-turn, never batched into one big text — Grok TTS is one voice per request, and per-turn caching depends on this.

---

## Phase Roadmap

| Phase | Focus | Effort | Status |
|-------|-------|--------|--------|
| P0 | Skeleton | 0.5d | ✅ shipped |
| P1 | TTS pipeline | 1d | ✅ shipped |
| P2 | Script generation polish | 1d | ✅ shipped |
| P3 | Editor power features | 2d | ✅ shipped |
| P4 | Render UI polish | 1d | ✅ shipped |
| P5 | Source variants (PDF/URL/DOCX) | 1d | ✅ shipped |
| P6 | Solo mode polish | 0.5d | ✅ shipped |
| P7 | Polish, perf, export | 1.5d | ✅ shipped (P7.2 skipped) |

---

## P2 — Script Generation Polish

**Goal:** make the generated scripts reliably good. Today the prompt is solid but there's no validation, no tag linting, and no observability into what the model actually returned.

### P2.1 — Tag Linter

The prompt says "max 3 speech tags per turn." Models occasionally ignore that. Add a post-generation linter that flags or auto-corrects.

**Files to create:**
- `server/src/lib/tagLinter.ts`

**Behavior:**
- Parse each turn's text. Count `[inline-tags]` and `<wrap-tags>...</wrap-tags>` occurrences.
- If a turn has more than 3 tags, log a warning with the turn id + count + first 80 chars of text.
- Optional auto-fix mode: keep only the first 3 tags, strip the rest.
- Return `{ turn_id, tag_count, warnings: string[] }[]` alongside the script.
- Validate that all wrap-tags are properly closed (no `<emphasis>foo` without `</emphasis>`).
- Validate that all tags use the Grok TTS supported set:
  - Inline: `[pause] [long-pause] [hum-tune] [laugh] [chuckle] [giggle] [cry] [tsk] [tongue-click] [lip-smack] [breath] [inhale] [exhale] [sigh]`
  - Wrap: `<soft> <whisper> <loud> <build-intensity> <decrease-intensity> <higher-pitch> <lower-pitch> <slow> <fast> <sing-song> <singing> <laugh-speak> <emphasis>`
- Unknown tags: log a warning, leave them in (they get sent to TTS as text and may cause weird output — let the user decide).

**Wire it in:**
- `server/src/routes/generateScript.ts` — call after `generateScript()`, before sending response. Add `lintWarnings: string[]` to the response.
- `client/src/routes/EditorScreen.tsx` — display a small warning banner if any turns have lint issues. Per-turn warnings show in the turn card footer (where `tags` count already appears — turn the count amber if `> 3`, which already happens in `TurnCard.tsx`).

**Definition of done:**
- Generate a script with a low-quality source that triggers tag overuse → see warnings surface in the UI
- Generate a clean script → no warnings
- Server logs show lint output

### P2.2 — Banned Phrase Detection

The prompt has a banned-phrases list. Verify the model actually obeyed it.

**Same file:** `server/src/lib/tagLinter.ts` (rename to `scriptLinter.ts` — broader scope)

**Banned list** (from the prompt):
```
"delve into", "let's unpack", "fascinating", "it's important to note",
"in today's fast-paced world", "buckle up", "dive deep",
"at the end of the day"
```

**Behavior:**
- Case-insensitive substring search across all turn text.
- For each hit: warning with the offending phrase + turn id.
- **Do not auto-fix** — flag only. Bad phrases sometimes are legitimate (e.g., "buckle up" in a script about car safety).
- Surface warnings in the editor as a non-blocking yellow banner at the top.

**Definition of done:**
- Add a quick test: generate a script with the source = "write about delving into AI" → confirm "delve into" gets flagged.

### P2.3 — Per-Turn LLM Regenerate

When a user clicks Regenerate on a turn, send a small surgical prompt with surrounding context.

**Files to create:**
- `server/src/routes/regenerateTurn.ts` — new endpoint `POST /api/regenerate-turn`
- `server/src/prompts/regenerate.ts` — the regeneration prompt template

**Prompt template** (from the spec doc, Section 5.5):
```
You are revising one turn in an existing podcast script. Maintain the
established voice, tone, and conversational flow. Match the speaker's
character (A=curious lead, B=warm explainer, or N=solo narrator).

PRECEDING TURNS:
{{prev_3_turns}}

CURRENT TURN (revise this):
Speaker {{speaker}}: {{current_text}}

FOLLOWING TURNS:
{{next_3_turns}}

USER GUIDANCE: {{regeneration_hint or "Make it more natural / shorter / tighter."}}

Return JSON: { "speaker": "...", "text": "..." }
Same speech-tag rules apply (sparing, max 3, only where natural).
```

**Request shape:**
```ts
POST /api/regenerate-turn
{
  turn: Turn,
  precedingTurns: Turn[],   // last 3 before
  followingTurns: Turn[],   // first 3 after
  hint?: string,
  config: ProjectConfig     // for tone/audience consistency
}
→ { turn: Turn }
```

**Client-side wiring:**
- `client/src/components/TurnCard.tsx` — add a small "↻ regenerate" button next to "▶ Preview". On click, open a tiny popover with an optional hint textarea + "Regenerate" button. Show a spinner in the card during the call. On success, replace turn text and invalidate the cached audio render.
- Reuse the `setTurnRender` action with `state: "idle"` to clear the audio cache for that turn.

**Definition of done:**
- Click ↻ on any turn → text changes
- Cached audio for that turn is gone (preview button shows the spinner first time after regen)
- Hint is honored ("make it shorter" → shorter text)

### P2.4 — Show the Prompt That Was Sent

For debugging and transparency, let users see what was sent to Grok.

**Where:** `EditorScreen` sidebar gets a collapsed `<details>` block:
```
▸ View prompt (debug)
```

**On expand:** show the full system prompt + user message that produced this script. Include a "Copy" button.

**Implementation:**
- Server returns `debugPrompt: { system: string, user: string }` alongside the script.
- Gate this behind a `?debug=1` URL param so it doesn't clutter normal use. Or always include it in the response and just hide the UI by default.

**Definition of done:**
- `?debug=1` shows the prompt panel
- Copy button puts the prompt on clipboard

---

## P3 — Editor Power Features

**Goal:** make the editor feel like a real writing tool, not a read-only preview.

### P3.1 — Add / Duplicate / Delete / Reorder Turns

**Store actions to add** in `client/src/store/projectStore.ts`:
```ts
insertTurn: (afterId: string | null, speaker: Speaker) => void
duplicateTurn: (id: string) => void
deleteTurn: (id: string) => void
moveTurn: (id: string, direction: "up" | "down") => void
```

**Generate new turn IDs:** `t${Date.now()}` is fine for uniqueness — the model uses `t1, t2, ...` but those are just identifiers, no ordering semantics.

**UI:**
- Turn card hover state: surface 4 small icon buttons in the right edge: ↑ ↓ ⎘ ✕ (move up, move down, duplicate, delete)
- Between every pair of turns: a thin "+ insert turn" affordance that appears on hover (collapses to nothing otherwise — don't add visual noise)
- New turns get default text: empty string + speaker matches the slot (alternates if two-host)

**Caching note:** when a turn moves, its cache stays valid (cache key is `turn.id + hash(text) + voice`). When a turn is deleted, drop its `turnRenders` entry.

**Definition of done:**
- Can build an episode entirely from scratch by repeatedly clicking "+ insert turn"
- Reordering 5 turns then re-rendering only re-renders changed/new turns (verify by network tab — only 0–2 TTS calls for an unchanged episode)

### P3.2 — Bulk Speaker Swap

Useful when the model assigned speakers wrong throughout.

**UI:** in the editor sidebar, a small button: "Swap all A↔B". Confirmation modal: "This will swap Host A and Host B for every turn. Continue?"

**Implementation:** trivial — map over turns, flip speaker. Invalidate all cached renders (since voice changes mean different audio).

### P3.3 — Smarter Tag Toolbar

Today the toolbar inserts raw tag text. Improve:

- For wrap tags: if user has selection, wrap it. If no selection, insert the open tag and place cursor between open/close. Already implemented — verify it actually works for all wrap tags.
- Add a small "ⓘ tag reference" link that opens a popover with the full Grok tag list and one-line descriptions.
- Add a keyboard shortcut: `Cmd/Ctrl+E` to wrap selection in `<emphasis>`.

### P3.4 — Per-Turn Voice Override

Sometimes a single line wants a different voice (a quoted passage in a different character). Add an override.

**Data model change:** add optional `voiceOverride?: VoiceId` to `Turn` in `shared/types.ts`.

**UI:** turn card gets a tiny voice badge near the speaker badge. Click to open a 5-voice picker (same component as `VoicePicker` but compact). When set, badge shows the voice name in mono caps. Reset option restores default.

**Render-side:** `voiceForTurn()` in `render.ts` checks `turn.voiceOverride` first, falls back to `config.voices[turn.speaker]`.

### P3.5 — Project Export / Import as JSON

**Export:**
- New action in store: `exportProject(): string` — serializes `{ sourceTitle, sourceText, config, script }` to JSON.
- Editor sidebar: "↓ Export Project (.json)" — downloads a `.podcastforge.json` file.

**Import:**
- Source screen: "↑ Import Project" file picker. Validates shape with a zod schema. Loads into store. Routes to editor if script is present, otherwise stays on source screen.
- Schema validation is critical — the persist middleware also reads localStorage which can be corrupted.

**Add zod:**
```bash
cd client && npm install zod
```

**Schema lives in:** `shared/schema.ts` (new file) — zod schemas for Turn, Script, ProjectConfig. Both client and server can validate against this.

**Definition of done:**
- Export → reload page → import → state matches what was exported
- Import a hand-edited JSON with a missing field → graceful error, no crash

---

## P4 — Render UI Polish

**Goal:** the render screen today works but feels thin. Make it production-ready.

### P4.1 — Per-Turn Retry

Today, render failures require re-running the whole episode. Add per-turn retry.

**Changes:**
- Each turn row in the progress list, on failed state, gets a "↻ retry" button.
- On click: re-call `synthesizeTurn(turn, config)` for just that turn, update its cache and render state.
- After retry succeeds, if the rest of the episode is done, re-stitch automatically.

### P4.2 — Streaming Render

Today, the user clicks "Render Episode" and waits 30–90 seconds with just a progress bar. Improve UX.

**Phase 1 (easy):** as each turn finishes synthesizing, the row's preview button becomes active. User can audition any individual turn while others are still synthesizing.

**Phase 2 (harder):** start playing the episode while later turns are still rendering. This is real engineering — needs a custom audio player that knows the planned schedule and can switch buffers as new ones arrive. Defer to v0.2 unless there's a specific demand.

### P4.3 — Estimated Time Remaining

The progress bar should show ETA based on completed turns × average synth time.

**Implementation:** track timestamps in `turnRenders[id].startedAt` and `completedAt`. After 3+ turns done, compute mean and project remaining.

### P4.4 — Save Final to Browser Downloads with Sensible Name

Today the download is named `episode.mp3` if no title. Improve:
- If title exists: `Title_Slug_2026-05-08.mp3`
- If no title: `PodcastForge_2026-05-08_HHmm.mp3`

### P4.5 — Show Total Audio Duration After Render

On the success card, show: `12:34 · 8.4 MB · high quality (44.1kHz)`. Already partial — make sure the duration and size are formatted human-readably.

---

## P5 — Source Variants (PDF / URL / DOCX)

**Goal:** today only paste works. Add PDF upload, URL fetch, and DOCX upload.

### P5.1 — PDF Extraction (client-side)

**Library:** `pdfjs-dist`

```bash
cd client && npm install pdfjs-dist
```

**File:** `client/src/lib/extractPdf.ts`

```ts
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export async function extractPdfText(file: File): Promise<string> {
  const ab = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: ab }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    pages.push(tc.items.map((it: any) => it.str).join(' '));
  }
  return pages.join('\n\n');
}
```

**UI on Source screen:**
- Tabs at top: `Paste Text | Upload File | URL`
- Upload tab accepts `.pdf, .txt, .md, .docx` via `<input type="file">`
- On select: extract text, show in a read-only preview, populate `sourceText` in store
- Show extraction progress for large PDFs (`docs.numPages > 50`)

### P5.2 — DOCX Extraction

**Library:** `mammoth`

```bash
cd client && npm install mammoth
```

```ts
import mammoth from 'mammoth';
export async function extractDocxText(file: File): Promise<string> {
  const ab = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: ab });
  return result.value;
}
```

### P5.3 — URL Fetch (server-side)

**Why server-side:** CORS. Browser can't fetch arbitrary domains.

**Endpoint:** `POST /api/fetch-url`

**Request:** `{ url: string }`
**Response:** `{ text: string, title?: string }`

**Library:** `@mozilla/readability` + `jsdom` for content extraction.

```bash
cd server && npm install @mozilla/readability jsdom
cd server && npm install --save-dev @types/jsdom
```

**Implementation:**
```ts
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
const html = await res.text();
const dom = new JSDOM(html, { url });
const reader = new Readability(dom.window.document);
const article = reader.parse();
return { text: article?.textContent || '', title: article?.title };
```

**Validation:**
- Validate URL with `new URL(input)` — reject if it throws
- Reject if not http/https
- Reject if hostname is localhost / private IP (SSRF prevention)
- 15s timeout
- Max response 5 MB

**SSRF guard:**
```ts
const u = new URL(input);
if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Bad protocol');
const host = u.hostname.toLowerCase();
const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
if (blocked.includes(host)) throw new Error('Blocked host');
if (host.startsWith('10.') || host.startsWith('192.168.') || /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)) {
  throw new Error('Private network blocked');
}
```

### P5.4 — Smart Source Title Defaults

When extracting from PDF/DOCX/URL, populate `sourceTitle` automatically:
- PDF: try `doc.getMetadata()` for `Title` field; fall back to filename
- DOCX: filename
- URL: use `article.title` from Readability

User can still edit the field — just give them a head start.

---

## P6 — Solo Mode Polish

**Goal:** solo mode works today but the editor doesn't visually distinguish it well, and the voice picker shows two slots even when only one is needed.

### P6.1 — Editor Adapts to Solo Mode

In `EditorScreen.tsx`, when `config.mode === "solo"`:
- Hide the Host A / Host B picker pair, show only Narrator picker (already done)
- All turn cards show speaker badge as `N` (already done)
- Hide the "Click to swap speaker" affordance on cards (today it's a no-op in solo mode, but the click still happens)

### P6.2 — Solo-Specific Default Voice

Today solo defaults to `leo`. Verify this is the right default vs `rex`. Quick A/B test: generate the same source under both, compare. Update default in `projectStore.ts` if needed.

### P6.3 — Solo Mode Tone Tweaks

Solo prompts may need slightly different tone defaults. Consider:
- Solo + `casual` feels under-developed — maybe rename `casual` to `conversational` for solo
- Solo + `documentary` is the strongest combo — make it the default

Decision: leave the four tone options the same, but change the default config to `documentary` when mode flips to solo. Implementation: in `patchConfig`, when `mode` flips to "solo" and tone is still the default `casual`, auto-set to `documentary`. Don't override if user has explicitly chosen.

---

## P7 — Polish, Performance, Robustness

**Status:** shipped except P7.2 (skipped) and P7.6 (simplified — defaults bumped without a formal listening session).

**Goal:** the things that turn a working prototype into a thing you'd ship.

### P7.1 — Move MP3 Encoding to a Web Worker — ✅ shipped

Today encoding happens on the main thread. For a 15-minute episode that's 3–5 seconds of UI freeze.

**File:** `client/src/lib/audio/encodeWorker.ts`

**Strategy:**
- Worker receives `{ pcm: Float32Array, sampleRate, bitRateKbps }` via `postMessage` with transferable
- Returns a `Blob` (Blobs aren't transferable — return the encoded Uint8Array and reconstruct the Blob on main thread)
- Main thread `render.ts` calls the worker via a Promise wrapper

**Vite worker syntax:**
```ts
import EncodeWorker from './encodeWorker?worker';
const worker = new EncodeWorker();
```

**Verify:** UI stays responsive (animations, button presses) during a 15-min episode encode.

**Implementation:** split into `encodeMp3Core.ts` (pure sync `encodeMp3Buffer`), `encodeWorker.ts` (worker entry), and `encodeMp3.ts` (async wrapper). PCM buffer is transferred to the worker (zero-copy). Worker is spawned per render and terminated on completion.

### P7.2 — Cost Ceiling Per Project — ⊘ skipped

Add a soft cap to prevent runaway spend.

**Config:** `costCeilingUsd: number` in `ProjectConfig`, default `5.00`.

**Pre-render check:** sum total chars across all turns × $4.20/1M = projected cost. If `>= ceiling`, show a confirmation dialog: "This render is estimated to cost $X.XX. Continue?"

**During render:** track actual char count synthesized. If running total approaches ceiling, abort with an error.

**Decision:** deferred. The pre-render check was deemed not worth the UX friction for a prototype, and mid-render abort would require AbortController plumbing through the existing `pMap` loop. Revisit if PodcastForge moves toward shared/multi-user deployment.

### P7.3 — Empty / Error / Loading States — ✅ shipped (scoped)

Audit every screen for:
- Initial empty state (Source with nothing pasted: shown well today)
- Loading state during generation/render (Source generating: shown today; refine spinner)
- Error state (network down, API key invalid, rate limited)
- 404 / unknown route fallback

Add a `<NotFoundScreen />` and a route `*` catchall.

**Implementation:** scoped to the genuine gaps rather than a full per-screen audit (existing screens already had decent empty/loading/error states). Added:
- `client/src/routes/NotFoundScreen.tsx` + `*` catchall route in `App.tsx`
- `client/src/components/ErrorBoundary.tsx` wrapping the route tree, with "Try again" and "Reset project + reload" actions
- `HealthBadge` now uses a 3s `AbortController` timeout (was hanging on "checking…" forever) and re-polls every 30s so the badge recovers automatically when the server comes back

### P7.4 — Better Server-Side Logging — ✅ shipped

Today server uses `console.error`. Add structured logging:

```bash
cd server && npm install pino pino-pretty
```

**Use:**
- INFO: every request with method, path, IP, char count, model used, latency
- WARN: rate limits hit, lint warnings
- ERROR: xAI API errors with status code + body excerpt

Don't log full request bodies (may contain PII). Just metadata.

**Implementation:** `pino` + `pino-http` wired through `server/src/index.ts`. Shared `server/src/lib/logger.ts` configures `pino-pretty` in dev, JSON in prod, with `authorization` and `cookie` headers redacted. All `console.*` in route handlers replaced with structured `logger.{info,warn,error}` calls including `{ err, route, status }` fields. `/api/health` is excluded from request logging since the `HealthBadge` polls it every 30s.

### P7.5 — Health Endpoint Improvements — ✅ shipped

Today `/api/health` returns a tiny JSON. Improve:

```json
{
  "ok": true,
  "service": "podcastforge",
  "version": "0.1.0",
  "uptime_sec": 12345,
  "hasApiKey": true,
  "modelDefault": "grok-4.3",
  "node": "20.x.x"
}
```

Consider adding an `/api/health/deep` that actually pings xAI's `/v1/models` endpoint to verify the key works. Cache the result for 60s.

**Implementation:** `/api/health` now returns `uptime_sec`, `modelDefault`, and `node` version alongside the existing fields. `/api/health/deep` calls a new `xaiPing()` helper in `xaiClient.ts` (5s timeout against `/v1/models`), cached for 60s in a module-level entry. Returns 200 even on xAI failure with `ok: false` and the error inline so external monitoring isn't tripped by transient xAI hiccups.

### P7.6 — Better Pause Tuning Defaults — ⤵ shipped (simplified)

Today: 250 ms speaker-switch / 150 ms same-speaker. These were chosen by intuition. Get one human (you) to listen to a generated 5-minute episode and adjust until it sounds right. Update the defaults in `projectStore.ts`.

Consider also: trailing-silence trim threshold. Today it's `-50 dBFS`. If episodes still feel stitched, try `-45`. If they feel too tight (words bleeding), try `-55`.

**Implementation:** bumped defaults to `pauseSpeakerSwitchMs: 350`, `pauseSameSpeakerMs: 200`, trim threshold `-45 dBFS` based on common podcast-editing wisdom. Did NOT do a formal listening session — those values are an educated guess. Existing localStorage projects keep their old values; only new projects pick up the new defaults. Re-tune by ear when you have a real episode you care about.

### P7.7 — README Updates — ✅ shipped

Update `README.md` to reflect everything shipped through P7. Add:
- Screenshots / GIFs of each screen (if you can produce them)
- Deployment guide (Cloud Run, Fly.io, or Vercel — pick one)
- Cost guide updated with real measurements after P7.2
- Troubleshooting: what to check when render fails (key issues, rate limits, browser memory for very long episodes)

**Implementation:** rewritten to reflect everything shipped through P7, with three real screenshots (Source / Editor / Render) under `docs/screenshots/`. Deployment guide and the suggested troubleshooting section are not yet covered — defer to a future docs pass.

### P7.8 — Add License File — ✅ shipped

Ship a `LICENSE` file. Default suggestion: MIT, with copyright "Andrew Krowczyk." Switch to private/proprietary if this isn't going OSS.

**Implementation:** MIT, © 2026 Andrew Krowczyk. Linked from the README footer.

---

## Stretch (post-v0.1, not blocking)

These are not part of the v0.1 commitment but are worth noting:

- **Custom voice cloning UI** — wire up `POST /v1/custom-voices` so users can upload a 30–120s reference clip and get a personalized voice ID. Voice library stored in localStorage.
- **Background music bed** — duck under speech, fade in/out at episode boundaries. Requires another audio mixing pass and a music asset library.
- **Chapter markers in MP3** — ID3 v2.4 CHAP frames mapped to turn boundaries or thematic beats.
- **RSS feed generator** — turn the app into a publishing pipeline. Each generated episode becomes a feed item.
- **Multi-source support** — combine 2–3 documents into one script. Probably needs a source-merging prompt step.
- **Show notes generation** — second LLM call after the script: extract the 5 key points, generate timestamps, format as markdown.

---

## Smoke Test Protocol

Run this before declaring any phase complete:

```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
cd client && npm run dev
```

Then in browser at `http://localhost:5173`:

1. Header dot is green (server up, key loaded).
2. Source screen — paste this 500-char test:
   > "The agentic AI shift in enterprise software isn't about replacing workers. It's about restructuring how knowledge work flows through an organization. Most companies are still in the pilot phase, treating AI agents like better chatbots. The real bet — the one a small number of forward-deployed teams are making — is that agents become the primary interface to enterprise systems within five years. Whether that bet pays off depends less on model capability and more on whether enterprises can rebuild their data and tool access layers fast enough."
3. Click Generate Script. Wait for editor.
4. Editor: at least 8 turns, alternating A/B, no banned phrases visible, no turn with > 3 tags (if there is, P2 lint would flag it).
5. Click ▶ on first turn. Audio plays through speakers.
6. Edit one turn's text. Click ▶ — audio reflects the edit (re-synthesizes since cache invalidated).
7. Click Render Audio → Render Episode. All turns go to "done."
8. Audio player appears with valid playback.
9. Click ↓ Download MP3. File downloads with sensible filename. Plays in QuickTime / VLC.
10. Refresh page. Source text + script are restored from localStorage. Final audio is gone (expected — blob URLs don't survive).
11. Hit `localhost:8787/api/health` directly in browser. Returns valid JSON.

Any failure here = phase isn't done.

---

## Code Style / Conventions

- **Components:** functional, hooks, named exports for shared, default exports for screens
- **State:** Zustand only. No Redux, no Context for app state. Local component state with `useState` for ephemeral UI.
- **Styling:** Tailwind utility classes. No CSS modules, no styled-components. Custom CSS only in `styles/index.css` for global stuff (grain overlay, scrollbars).
- **Types:** strict everywhere. No `any` except for legacy library types (`pdfjs` items). Cast at the boundary, not throughout the code.
- **Error handling:** server returns `{ error: string, details?: string }` JSON with appropriate HTTP status. Client surfaces `details || error` to user.
- **No `console.log` in committed code.** Use the logger (P7.4) on server, remove on client.
- **Async:** prefer `async/await`. No `.then()` chains except where unavoidable (Web APIs, SDKs).
- **File naming:** `camelCase.ts` for utils, `PascalCase.tsx` for components.

---

## Files You Will Touch by Phase

For quick orientation:

**P2:** `server/src/lib/scriptLinter.ts` (new), `server/src/routes/generateScript.ts`, `server/src/routes/regenerateTurn.ts` (new), `server/src/prompts/regenerate.ts` (new), `client/src/components/TurnCard.tsx`, `client/src/routes/EditorScreen.tsx`

**P3:** `client/src/store/projectStore.ts`, `client/src/components/TurnCard.tsx`, `client/src/routes/EditorScreen.tsx`, `shared/schema.ts` (new), `shared/types.ts`

**P4:** `client/src/routes/RenderScreen.tsx`, `client/src/lib/audio/render.ts`

**P5:** `client/src/lib/extractPdf.ts` (new), `client/src/lib/extractDocx.ts` (new), `client/src/routes/SourceScreen.tsx`, `server/src/routes/fetchUrl.ts` (new)

**P6:** `client/src/routes/EditorScreen.tsx`, `client/src/components/TurnCard.tsx`, `client/src/store/projectStore.ts`

**P7:** `client/src/lib/audio/encodeWorker.ts` (new), `client/src/lib/audio/render.ts`, `server/src/index.ts`, `server/src/routes/health.ts`, `client/src/routes/RenderScreen.tsx`, `README.md`

---

## When in Doubt

- **Architectural questions:** the spec doc (`PodcastForge_Build_Plan_v0.1.docx`) is the source of truth for design decisions and Grok API details.
- **Grok API uncertainty:** docs at https://docs.x.ai are the ground truth. Don't trust your memory — the API surface has been moving.
- **Aesthetic questions:** monochrome black/white only. Single signal-red accent (`#FF3B00`) reserved for in-flight progress. No purple gradients, no rounded corners except progress bars, hairline borders, generous whitespace, `Inter Tight` for display + `JetBrains Mono` for metadata. If you're tempted to add color, don't.

---

*Last updated: 2026-05-08*
*v0.1 complete: P0–P7 shipped (P7.2 cost ceiling skipped, P7.6 pause tuning shipped as defaults bump rather than full listening pass).*
