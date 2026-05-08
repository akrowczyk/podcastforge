<div align="center">

**RedPath Technologies**

# PodcastForge

*A NotebookLM-Style Podcast Generator on the Grok Voice Stack*

**Build Plan & Technical Specification — Vite + React**

Version 0.1 — Draft for Review

</div>

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Grok API Reference (Grounded)](#3-grok-api-reference-grounded)
4. [UX Flow & Screen-by-Screen Spec](#4-ux-flow--screen-by-screen-spec)
5. [Prompt Engineering for Script Generation](#5-prompt-engineering-for-script-generation)
6. [Data Model](#6-data-model)
7. [Server (Proxy) API](#7-server-proxy-api)
8. [Audio Rendering Pipeline](#8-audio-rendering-pipeline)
9. [Build Roadmap](#9-build-roadmap)
10. [Risks & Open Questions](#10-risks--open-questions)
- [Appendix A — Sample Generated Output](#appendix-a--sample-generated-output)
- [Appendix B — Project Folder Structure](#appendix-b--project-folder-structure)

---

# 1. Executive Summary

PodcastForge is a Vite + React single-page application that replicates the core experience of Google NotebookLM's Audio Overview feature — converting source material into a natural, two-host conversational podcast — built on xAI's Grok stack. The app uses Grok 4.3 (text) for script generation and the Grok TTS API for voice synthesis, supporting both single-narrator and two-host dialogue modes.

The defining feature is editable script staging: rather than going source → audio in one shot, the user reviews and edits the generated script line-by-line before synthesis. This is critical because (a) LLM-generated scripts often need pacing/factual cleanup, (b) re-rendering audio is metered, and (c) per-line voice and speech-tag tuning is what separates a flat read-aloud from a believable conversation.

> **WHY GROK FOR THIS**
>
> At $4.20 per 1M characters, Grok TTS is roughly 70× cheaper than ElevenLabs API pricing while delivering 5 expressive voices, inline emotion tags (`[laugh]`, `[sigh]`, `<whisper>`, `<emphasis>`), 48 kHz studio-grade output, and BCP-47 multilingual support. A typical 12-minute two-host episode (~14,000 characters) costs approximately $0.06 in TTS plus pennies in script generation.

## 1.1 Goals

- Replicate the NotebookLM two-host conversational dynamic — banter, hand-offs, agreement, gentle disagreement, and natural pacing.
- Support a single-narrator mode for explainer-style content where dialogue would feel forced.
- Provide a script editing surface (turn-by-turn) before audio commits.
- Produce a single, sequenced MP3 file with proper inter-turn pacing and minimal seams.
- Keep the architecture simple: client-side state, thin proxy server only for API key protection.

## 1.2 Non-Goals (v0.1)

- Real-time streaming generation (this is a batch/render product, not a live agent).
- Source ingestion of large corpora — v0.1 accepts pasted text or a single uploaded file (PDF/TXT/MD up to ~50 pages).
- Multi-host dialogue beyond two speakers.
- User authentication or persistence across sessions (browser-local only in v0.1).

---

# 2. System Architecture

The app is a two-tier system: a Vite/React SPA and a minimal Node/Express proxy. The proxy exists for one reason — keeping the xAI API key off the client. All orchestration logic (script parsing, turn sequencing, audio stitching) runs in the browser to keep the server stateless and trivially deployable.

## 2.1 High-Level Flow

1. **Source Intake** — User pastes text, uploads PDF/TXT/MD, or supplies a URL. Client extracts plaintext (pdf.js for PDFs).
2. **Script Generation** — Client POSTs source + config (mode, length, tone) to `/api/generate-script` → proxy calls Grok 4.3 chat completions → returns structured JSON script.
3. **Script Editor** — User reviews the parsed script in a turn-by-turn editor. Edit text, change speaker, insert/delete turns, tweak speech tags, regenerate single turns.
4. **Voice Assignment** — User picks voices (Eve, Ara, Rex, Sal, Leo) for Host A and Host B (or just Host A in solo mode).
5. **Synthesis** — Client iterates turns, POSTing each to `/api/tts` → proxy calls Grok TTS → returns MP3 bytes per turn. Concurrency capped at 4 to respect rate limits.
6. **Stitching** — Browser uses Web Audio API to decode each MP3, concatenate with configurable inter-turn pauses (default 250 ms host-switch / 150 ms same-speaker), re-encode as a single MP3 via lamejs.
7. **Export** — Single downloadable MP3 plus optional `script.json` sidecar (for re-editing later).

## 2.2 Component Diagram (Logical)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (Vite + React)                       │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │   Sources    │→ │  Generator   │→ │ Script Editor│→ │ Renderer │ │
│  │  (paste/PDF) │  │   (config)   │  │ (turn list)  │  │ (stitch) │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────┘ │
│                            │                  │              │       │
│                            ▼                  ▼              ▼       │
│                     ┌────────────────────────────────────────────┐  │
│                     │         Zustand Store (project state)      │  │
│                     └────────────────────────────────────────────┘  │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │  HTTPS (no API key on client)
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Express Proxy (Node 20+)                          │
│                                                                       │
│   /api/generate-script  ──→  POST https://api.x.ai/v1/chat/...       │
│   /api/tts              ──→  POST https://api.x.ai/v1/tts            │
│   /api/health           ──→  liveness                                 │
└─────────────────────────────────────────────────────────────────────┘
```

## 2.3 Tech Stack

| Layer        | Choice                          | Rationale                                                   |
|--------------|---------------------------------|-------------------------------------------------------------|
| Build        | Vite 5                          | Fast HMR, native ESM, zero-config TS                        |
| UI           | React 18 + TypeScript           | Standard for state-heavy editors                            |
| State        | Zustand                         | Lightweight, no provider hell, persists to localStorage trivially |
| Styling      | Tailwind CSS + shadcn/ui        | Polished components without time sink                       |
| Forms        | react-hook-form + zod           | Schema validation for script JSON                           |
| Audio decode | Web Audio API                   | Native, no deps                                             |
| MP3 encode   | @breezystack/lamejs             | Maintained lamejs fork, encodes in browser                  |
| PDF parse    | pdfjs-dist                      | Client-side text extraction                                 |
| Server       | Express + TypeScript            | Trivial to deploy on Cloud Run / Fly.io                     |
| HTTP         | undici (Node) / fetch (browser) | Native streaming support                                    |

---

# 3. Grok API Reference (Grounded)

All facts in this section are taken from xAI's published documentation as of May 2026. Andrew should re-verify before implementation in case of subsequent changes.

## 3.1 Text Generation — Script Authoring

Use the standard chat completions endpoint with the `grok-4.3` model for scripts. Grok 4.3 is xAI's flagship reasoning model with the lowest hallucination rate in their lineup; the non-reasoning variant `grok-4.20-non-reasoning` is acceptable for simpler/shorter scripts where speed beats depth.

| Field              | Value                                                  |
|--------------------|--------------------------------------------------------|
| Endpoint           | `POST https://api.x.ai/v1/chat/completions`            |
| Auth               | `Authorization: Bearer ${XAI_API_KEY}`                 |
| Model (default)    | `grok-4.3`                                             |
| Model (fast/cheap) | `grok-4.20-non-reasoning`                              |
| Response format    | JSON mode via `response_format: { type: "json_object" }` |
| SDK option         | OpenAI SDK with `base_url="https://api.x.ai/v1"`       |

## 3.2 Text-to-Speech — Voice Synthesis

This is the workhorse of the app. The REST endpoint is the right choice for podcast generation; the WebSocket streaming variant has no length limit but adds complexity we don't need for batch render.

| Field                       | Value                                                                         |
|-----------------------------|-------------------------------------------------------------------------------|
| Endpoint                    | `POST https://api.x.ai/v1/tts`                                                |
| Response                    | Raw audio bytes (binary) — not JSON                                           |
| Max chars / unary request   | 15,000 (chunk longer turns)                                                   |
| Pricing                     | $4.20 per 1M characters                                                       |
| Built-in voices             | `eve` (default), `ara`, `rex`, `sal`, `leo`                                   |
| Output codecs               | mp3, wav, pcm (Linear16), mulaw, alaw                                         |
| Sample rates                | 8k / 16k / 22.05k / 24k (default) / 44.1k / 48k Hz                            |
| Languages                   | 20+ auto-detected; pass `language` for determinism                            |
| Custom voices               | `POST /v1/custom-voices` with reference clip ≤120s, then use returned `voice_id` |

### 3.2.1 Voice Casting Guide

| voice_id | Character                              | Best Role in PodcastForge                       |
|----------|----------------------------------------|-------------------------------------------------|
| `eve`    | Upbeat, conversational (default)       | Energetic Host A — leads, asks the questions    |
| `ara`    | Warm, conversational, customer-support | Friendly Host B — softer counterweight          |
| `rex`    | Business/corporate, presentational     | Solo narrator for technical/finance content     |
| `sal`    | Versatile, balanced                    | Either host; safe pairing with any other voice  |
| `leo`    | Authoritative, instructional           | Solo narrator for documentary/educational tone  |

> **RECOMMENDED PAIRING**
>
> Default two-host pairing: `eve` (Host A) + `ara` (Host B). Both lean conversational with distinct timbres — listener can immediately tell them apart, neither feels stiff. For a more contrasted dynamic try `eve` + `leo` (energetic vs. authoritative).

### 3.2.2 Speech Tags (the secret sauce)

Grok TTS supports two tag families. Inline tags use square brackets and insert a single sound at that point. Wrapping tags use angle brackets and modify the enclosed phrase.

**Inline (point-event) tags:**

```
[pause]   [long-pause]   [hum-tune]
[laugh]   [chuckle]      [giggle]      [cry]
[tsk]     [tongue-click] [lip-smack]
[breath]  [inhale]       [exhale]      [sigh]
```

**Wrapping (modifier) tags** — wrap the text you want modified:

```
<soft>...</soft>            <whisper>...</whisper>      <loud>...</loud>
<build-intensity>...</build-intensity>   <decrease-intensity>...</decrease-intensity>
<higher-pitch>...</higher-pitch>         <lower-pitch>...</lower-pitch>
<slow>...</slow>            <fast>...</fast>
<sing-song>...</sing-song>  <singing>...</singing>
<laugh-speak>...</laugh-speak>           <emphasis>...</emphasis>
```

> ⚠ **TAG DISCIPLINE**
>
> Overusing tags is the #1 way to make TTS sound worse. The script generator prompt explicitly limits tags to ≤3 per turn and only at points where a real podcast host would naturally use them (genuine surprise, a beat before a punchline, a soft aside). Most turns should have zero tags — natural punctuation does most of the work.

## 3.3 Sample TTS Request

```http
POST https://api.x.ai/v1/tts
Authorization: Bearer $XAI_API_KEY
Content-Type: application/json

{
  "text": "Welcome back. So [pause] I read this paper last night and it... <emphasis>changed how I think about agents</emphasis>.",
  "voice_id": "eve",
  "language": "en",
  "output_format": {
    "codec": "mp3",
    "sample_rate": 44100,
    "bit_rate": 192000
  }
}

→ HTTP 200, body = raw MP3 bytes
```

## 3.4 Cost Model — Worked Example

A 12-minute two-host episode synthesizes around 14,000 characters of dialogue. Script generation runs ~6,000 input tokens + 4,000 output tokens with `grok-4.3`. Approximate per-episode cost:

| Line Item                         | Quantity     | Cost   |
|-----------------------------------|--------------|--------|
| Script generation (grok-4.3)      | ~10K tokens  | ~$0.05 |
| TTS synthesis (Grok TTS)          | 14,000 chars | $0.06  |
| **Total per episode**             | —            | **~$0.11** |
| At 100 episodes/month             | —            | ~$11.00 |

---

# 4. UX Flow & Screen-by-Screen Spec

## 4.1 Screen 1 — Source

Single-purpose screen. The user supplies the source material and configures podcast-level settings.

### Inputs

- **Source:** tabbed input with three modes — Paste Text, Upload File (PDF/TXT/MD/DOCX), or Fetch URL (server-side fetch + readability extraction).
- **Title** (optional, free-form).
- **Mode toggle:** Two-Host Conversation (default) | Solo Narrator.
- **Target length:** Short (~5 min, ~6K chars), Medium (~10 min, ~12K chars), Long (~18 min, ~22K chars).
- **Tone:** Casual & Curious | Professional & Analytical | Energetic & Punchy | Documentary.
- **Audience:** General | Technical | Executive (affects vocabulary and depth of asides).
- **Optional focus prompt** (free text): "Spend extra time on the agentic AI section" / "Skip the legal disclaimers."

### Action

`[Generate Script]` button → calls `/api/generate-script` with the configured prompt → routes to Screen 2.

## 4.2 Screen 2 — Script Editor (the heart of the app)

This is where users spend most of their time and where the app's value over a one-shot generator lives. The script renders as a vertical list of editable turn cards.

### Turn Card Anatomy

- Speaker badge (left edge, color-coded — Host A blue, Host B amber, Narrator gray). Click to swap.
- Editable text area, auto-growing, with inline tag highlighting (regex-driven syntax color).
- Tag insert toolbar: quick buttons for `[pause]`, `[laugh]`, `<emphasis>`, `<whisper>`, `<slow>`.
- Per-turn actions: Regenerate (sends just this turn back to Grok with surrounding context), Duplicate, Delete, Move Up/Down.
- Char counter + estimated TTS cost (live).

### Toolbar (top of editor)

- Voice picker for Host A and Host B (dropdown of 5 voices + custom).
- `[+ Add Turn]` above/below selection.
- `[Regenerate Whole Script]` (with confirm — destroys edits).
- `[Preview Single Turn]` — synthesizes just the highlighted turn so you can audition before committing.
- Stats: total chars, est. duration, est. cost.
- `[Render Audio →]` proceeds to Screen 3.

> ⚡ **CRITICAL UX DETAIL**
>
> The 'Preview Single Turn' button is the single most important affordance in the app. Without per-turn auditioning, users either render the whole episode (slow, costs money) or commit blind. Cache previews keyed by `(text, voice_id)` so re-clicking is free.

## 4.3 Screen 3 — Render & Export

Renders the full episode. Shows a turn-by-turn progress list (each row: speaker, text snippet, status: queued / in-flight / done / failed). Failed turns are individually retriable without re-rendering the whole episode.

### Render Settings

- Audio quality: Standard (24 kHz / 128 kbps) | High (44.1 kHz / 192 kbps) | Studio (48 kHz / 256 kbps).
- Inter-turn pause when speaker changes (default 250 ms, range 100–600 ms).
- Inter-turn pause when same speaker continues (default 150 ms).
- Concurrency: 1–6 parallel TTS requests (default 4).

### Export

- `[Download MP3]` — primary output.
- `[Download Project (.json)]` — script + config, re-importable on Screen 1.
- `[Copy Transcript]` — plain-text dialogue with speaker names, no tags.

---

# 5. Prompt Engineering for Script Generation

This section is the highest-leverage part of the build. Audio quality is bounded by script quality. The prompts below are tuned to produce the NotebookLM banter feel: hosts who actually listen to each other, build on each other's points, and disagree gently.

## 5.1 Two-Host System Prompt (Production Version)

> 🔒 **USE VERBATIM**
>
> This prompt is the result of multiple design decisions: explicit personas (so voices have consistent character across turns), strict JSON output (for reliable parsing), tag budget (to prevent overuse), and anti-AI-isms (to avoid the 'In conclusion, it's important to note...' filler that ruins TTS output).

```
You are a podcast script writer for "PodcastForge", a NotebookLM-style
two-host show. Your job is to turn source material into a natural, engaging
conversation between two hosts.

HOSTS
- Host A ("Eve"): the curious lead. Drives the conversation, asks the
  questions a smart listener would ask, sets up topics. Slightly more
  energetic. Prone to genuine reactions ("Wait, really?", "Huh.").
- Host B ("Ara"): the warm explainer. Has read the source carefully and
  is the one who actually knows the material. Answers Host A's questions
  with concrete detail. Occasionally pushes back or adds nuance.

This is a CONVERSATION, not alternating monologues. Hosts interrupt each
other (briefly), build on each other's points, react, agree, disagree,
crack the occasional dry joke. They do NOT take turns delivering
paragraph-long lectures.

STRUCTURE
1. Cold open (15-30s): Host A hooks the listener with the most surprising
   or relatable angle from the source. NO "Welcome to the show" preambles.
2. Body: 4-7 thematic beats, each 60-120 seconds. Each beat opens with a
   question or provocation, develops via back-and-forth, lands on a
   takeaway before pivoting.
3. Close (15-30s): one of the hosts surfaces the single thing the listener
   should remember. Brief sign-off, no theme music description.

VOICE & STYLE
- Conversational English. Contractions. Sentence fragments are fine.
- Vary sentence length aggressively. Short. Then long, winding sentences
  that meander toward a point. Then short again.
- Short turns (1-3 sentences) outnumber long turns (4-6 sentences) at
  least 2:1.
- Hosts use each other's names sparingly (1-2 times max per episode).
- BANNED phrases: "delve into", "let's unpack", "fascinating", "it's
  important to note", "in today's fast-paced world", "buckle up", "dive
  deep", "at the end of the day". If you write any of these, the script
  is rejected.

SPEECH TAGS (use SPARINGLY - max 3 per turn, most turns have zero)
- [pause] - genuine beat before something significant. Not for filler.
- [laugh] / [chuckle] - actual amusement, not punctuation.
- <emphasis>word</emphasis> - the one word in the sentence that carries
  the meaning.
- <slow>...</slow> - reserved for the punchline or the surprising stat.
- <whisper>...</whisper> - rare; only for genuine asides.
Do NOT pepper tags through the script. A clean turn with no tags reads
better than a turn cluttered with [chuckle] and <emphasis>.

LENGTH TARGET
{{LENGTH_INSTRUCTION}}

TONE
{{TONE_INSTRUCTION}}

AUDIENCE
{{AUDIENCE_INSTRUCTION}}

OUTPUT FORMAT (STRICT)
Return ONLY a JSON object matching this schema, no preamble, no markdown:

{
  "title": "string",
  "estimated_duration_seconds": number,
  "turns": [
    {
      "id": "t1",
      "speaker": "A" | "B",
      "text": "string with optional speech tags"
    }
  ]
}

The "text" field is what gets sent to TTS - speech tags must be valid
Grok TTS syntax. Do NOT include speaker names in the text.
```

## 5.2 Length / Tone / Audience Modifiers

These are templated into the system prompt above. Keeping them as separate string blocks makes them easy to A/B test.

### Length Instructions

```
SHORT:  ~5 minutes, target 6,000-7,000 characters total across all turns,
        roughly 18-25 turns. Cut ruthlessly to the 2-3 most important
        ideas from the source.

MEDIUM: ~10 minutes, target 11,000-13,000 characters, 35-50 turns.
        Cover 4-6 ideas with room to develop each.

LONG:   ~18 minutes, target 20,000-24,000 characters, 60-90 turns.
        Cover the full source with depth. Multiple beats per topic.
```

### Tone Instructions

```
CASUAL:        Hosts sound like two smart friends at a coffee shop.
               Mild humor encouraged. Personal reactions welcomed.

PROFESSIONAL:  Hosts are subject-matter experts on a quality podcast.
               Curious but precise. Humor is dry, not jokey.

ENERGETIC:     Hosts are excited about the material. Faster pacing.
               More interjections. Still listening to each other -
               not just talking over.

DOCUMENTARY:   Hosts speak with measured authority. More structured
               beats. Less banter, more substance per turn.
```

### Audience Instructions

```
GENERAL:       Assume the listener is curious but not specialist. Define
               jargon the first time it's used (briefly).

TECHNICAL:     Assume the listener is in the field. Use jargon directly.
               Hosts can debate implementation tradeoffs.

EXECUTIVE:     Assume the listener cares about implications, decisions,
               and risk. Lead with "so what" before "here's how".
```

## 5.3 Solo Narrator System Prompt

For solo mode, swap to this prompt — the structure is fundamentally different (no banter, but also no monologue dump).

```
You are a podcast narrator for a solo-host explainer show. Your job is
to turn source material into an engaging single-voice script that doesn't
feel like a lecture.

NARRATOR ROLE
You are a warm, knowledgeable host (think long-form NPR style). You are
narrating directly to one listener. You think out loud. You ask rhetorical
questions and answer them. You occasionally surface your own reaction to
what you're explaining ("which honestly surprised me when I first saw
this...").

STRUCTURE
1. Cold open: lead with the most surprising claim or anecdote from the
   source. NO "Hello and welcome".
2. Body: 4-6 thematic beats. Each beat opens with a hook, develops the
   idea, lands a takeaway. Use rhetorical questions to pivot between
   beats ("So what's actually going on here?").
3. Close: one sentence the listener should remember. Brief sign-off.

VOICE & STYLE
- Conversational. Contractions. Sentence fragments fine.
- Aggressive sentence-length variety - short punches between long
  meandering sentences.
- Address the listener as "you" sometimes ("you might be wondering...").
- BANNED phrases: same list as two-host mode.

SPEECH TAGS
Same rules - sparing, max 3 per turn, most turns zero.
[pause] before pivots. <emphasis> on the word that carries the meaning.

OUTPUT (STRICT JSON)
{
  "title": "string",
  "estimated_duration_seconds": number,
  "turns": [
    { "id": "t1", "speaker": "N", "text": "..." }
  ]
}

Each turn is a continuous narrative paragraph. Use turn boundaries to
mark natural beat changes - the renderer adds a small pause between
turns, which gives the script natural breathing room.
```

## 5.4 User Message Template

The system prompt above is constant per mode. The user message wraps the source content:

```
Source title: {{TITLE}}

Optional focus from user: {{FOCUS_PROMPT or "none"}}

----- SOURCE CONTENT -----
{{SOURCE_TEXT}}
----- END SOURCE CONTENT -----

Generate the podcast script now. Return JSON only.
```

## 5.5 Per-Turn Regeneration Prompt

When the user clicks Regenerate on a single turn, we send a smaller, surgical prompt with surrounding context so the regenerated turn fits the conversation:

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

---

# 6. Data Model

Single project object holds everything. Persists to localStorage automatically; exportable as JSON.

```ts
type Project = {
  id: string;                    // uuid
  title: string;
  createdAt: string;             // ISO
  updatedAt: string;
  config: {
    mode: "two-host" | "solo";
    length: "short" | "medium" | "long";
    tone: "casual" | "professional" | "energetic" | "documentary";
    audience: "general" | "technical" | "executive";
    focusPrompt?: string;
    voices: {
      A: VoiceId;                // default: "eve"
      B?: VoiceId;               // default: "ara" (only if two-host)
      N?: VoiceId;               // default: "leo" (only if solo)
    };
    audioQuality: "standard" | "high" | "studio";
    pauseSpeakerSwitchMs: number;  // default 250
    pauseSameSpeakerMs: number;    // default 150
  };
  source: {
    kind: "paste" | "file" | "url";
    rawText: string;
    fileName?: string;
    sourceUrl?: string;
    charCount: number;
  };
  script: {
    estimatedDurationSeconds: number;
    turns: Turn[];
  } | null;
  renderState: {
    status: "idle" | "rendering" | "done" | "failed";
    perTurnStatus: Record<string, TurnRenderStatus>;
    finalAudioBlobUrl?: string;
  };
};

type Turn = {
  id: string;                    // "t1", "t2", ...
  speaker: "A" | "B" | "N";
  text: string;                  // includes Grok TTS speech tags
};

type TurnRenderStatus = {
  state: "queued" | "rendering" | "done" | "failed";
  audioBlobUrl?: string;
  error?: string;
  durationSec?: number;
  charCount: number;
};

type VoiceId = "eve" | "ara" | "rex" | "sal" | "leo" | string; // string = custom
```

---

# 7. Server (Proxy) API

The server has three endpoints. Keep it stateless. Do not log raw source content; do log request metadata + char counts for billing visibility.

## 7.1 POST `/api/generate-script`

```
Request body:
{
  "config": Project["config"],
  "source": Project["source"]
}

Server responsibility:
1. Pick the right system prompt (two-host vs solo).
2. Inject length/tone/audience modifiers.
3. Call Grok 4.3 chat completions with response_format json_object.
4. Validate JSON against schema (zod).
5. Assign turn IDs (t1, t2, ...).
6. Return parsed { title, estimatedDurationSeconds, turns }.

On Grok error: return 502 with structured error.
Timeout: 120s (long scripts can take 60-90s on grok-4.3).
```

## 7.2 POST `/api/tts`

```
Request body:
{
  "text": string,                // 1-15000 chars
  "voiceId": string,             // eve | ara | rex | sal | leo | custom
  "language": string,            // BCP-47, default "en"
  "audioQuality": "standard" | "high" | "studio"
}

Server responsibility:
1. Validate length <= 15,000 chars (else 400).
2. Map audioQuality to Grok output_format:
   standard: { codec: "mp3", sample_rate: 24000, bit_rate: 128000 }
   high:     { codec: "mp3", sample_rate: 44100, bit_rate: 192000 }
   studio:   { codec: "mp3", sample_rate: 48000, bit_rate: 256000 }
3. POST to https://api.x.ai/v1/tts with Bearer auth.
4. Stream the response body back to client untouched (Content-Type: audio/mpeg).

Rate limiting: per-IP token bucket (e.g. 60 req/min) to prevent runaway costs.
```

## 7.3 GET `/api/health`

Returns 200 OK with `{ ok: true, version, gitSha }` for liveness probes.

---

# 8. Audio Rendering Pipeline

This is where most of the engineering subtlety lives — the difference between a polished output and an obviously-stitched one.

## 8.1 Sequencing Algorithm

```ts
async function renderEpisode(turns, config) {
  // Step 1: Synthesize each turn in parallel (capped concurrency).
  const audioBuffers = await pMap(
    turns,
    async (turn) => {
      const voiceId = config.voices[turn.speaker];
      const mp3Bytes = await fetch("/api/tts", { ... }).then(r => r.arrayBuffer());
      const audioCtx = new AudioContext({ sampleRate: getSampleRate(config.audioQuality) });
      const decoded = await audioCtx.decodeAudioData(mp3Bytes);
      return { turnId: turn.id, decoded, speaker: turn.speaker };
    },
    { concurrency: 4 }
  );

  // Step 2: Concatenate with appropriate inter-turn pauses.
  const sampleRate = getSampleRate(config.audioQuality);
  const segments = [];
  for (let i = 0; i < audioBuffers.length; i++) {
    segments.push(audioBuffers[i].decoded);
    if (i < audioBuffers.length - 1) {
      const sameSpeaker =
        audioBuffers[i].speaker === audioBuffers[i + 1].speaker;
      const pauseMs = sameSpeaker
        ? config.pauseSameSpeakerMs
        : config.pauseSpeakerSwitchMs;
      segments.push(silenceBuffer(pauseMs, sampleRate));
    }
  }

  // Step 3: Concatenate into single AudioBuffer, encode to MP3.
  const merged = mergeBuffers(segments, sampleRate);
  const mp3Blob = encodeMp3(merged, sampleRate, getBitRate(config.audioQuality));
  return URL.createObjectURL(mp3Blob);
}
```

## 8.2 Why Per-Turn Synthesis Beats One Big Call

1. **Voice switching:** Grok TTS only renders one voice per request, so multi-host requires per-turn calls anyway.
2. **Resilience:** a single failed turn doesn't kill the whole render — retry just that turn.
3. **Caching:** per-turn caching means edits only re-render touched turns. The 90% of turns the user didn't edit reuse cached audio.
4. **Concurrency:** parallel calls cut total render time roughly proportional to concurrency cap.
5. **Preview:** the same per-turn synthesis pathway powers the 'Preview Single Turn' button on the editor.

## 8.3 Pause Tuning (the seam problem)

Grok TTS may add a small amount of trailing silence to each clip. If you concatenate raw, you get long awkward gaps when the clip's natural tail-silence stacks with your inter-turn pause. Two mitigations:

- Trim 50–100 ms of trailing silence from each decoded buffer before concat (simple amplitude-threshold scan from the end).
- Calibrate default pauses against trimmed clips: 250 ms speaker-switch / 150 ms same-speaker feel right with trimming; bump both ~80 ms if you skip trimming.

---

# 9. Build Roadmap

Sequenced for fastest path to a working end-to-end loop, then quality polish. Each phase is a working app — no big-bang phases.

| Phase | Scope | Effort |
|-------|-------|--------|
| **P0 — Skeleton** | Vite + React + Tailwind scaffold. Express proxy with `/api/health`. Tailwind/shadcn theme. Zustand store with Project type. | 0.5 day |
| **P1 — TTS Pipeline** | `/api/tts` endpoint. Per-turn audio fetch. Web Audio decode. lamejs encode. Hardcoded 5-turn dialogue test. | 1 day |
| **P2 — Script Generation** | `/api/generate-script` endpoint with the two-host prompt. Source paste UI. JSON schema validation. Render generated script as read-only list. | 1 day |
| **P3 — Editor** | Editable turn cards. Speaker swap. Tag toolbar. Add/Delete/Move turns. Per-turn regenerate. Per-turn preview. | 2 days |
| **P4 — Render UI** | Render screen with progress, retries, settings, final MP3 download. | 1 day |
| **P5 — Source Variants** | PDF upload + pdfjs extraction. URL fetch on server. DOCX support. | 1 day |
| **P6 — Solo Mode** | Solo prompt path. Mode toggle on Source screen. Single-voice render. | 0.5 day |
| **P7 — Polish** | Pause trimming. Caching. Project export/import. Cost estimator. Empty/error states. | 1.5 days |
| **TOTAL** | — | **~8.5 days** |

## 9.1 Stretch Items (post v0.1)

- Custom voice cloning UI (upload reference clip → `/v1/custom-voices` → save to user's voice library).
- Multi-source support — combine 2–3 documents into a single script.
- Background music bed — duck under speech, fade in/out at episode boundaries.
- Chapter markers in the output MP3 (ID3 v2.4 CHAP frames).
- RSS feed generator — turn the app into a podcast publishing pipeline.
- Streaming render — start playing the first turn while later turns are still synthesizing.

---

# 10. Risks & Open Questions

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| LLM script quality varies — hosts sound robotic / "AI voice" | High | Banned-phrase list in prompt. Iterate prompts based on real outputs. Per-turn regeneration UX is the safety valve. |
| TTS speech tags get over-applied by the LLM | Medium | Explicit max-3-tags-per-turn rule + post-generation linter that strips excess tags. |
| Inter-turn seams sound stitched | Medium | Trailing-silence trim. Configurable inter-turn pause. Audition tooling on Preview button. |
| Browser MP3 encoding (lamejs) is slow on mobile | Medium | Move encode to a Web Worker. For very long episodes, offer a server-side encode fallback. |
| xAI API outages / rate limits | Low | Per-turn retry with exponential backoff. Surface clear error states. Cap concurrency. |
| Cost runaway from accidental loops | Low | Server-side per-IP rate limit + per-project cost ceiling (configurable, default $5/project). |
| Custom voices not yet on REST endpoint | Unknown | Confirm with xAI docs at build time; gate the feature flag. |

## 10.1 Open Questions for Andrew

1. **Hosting target** — Cloud Run, Fly.io, Vercel + serverless functions, or run as an Electron app? Affects how we package the proxy.
2. **Auth** — v0.1 is single-user/no-auth. Do we need a simple shared password gate before going live, or is local-only fine?
3. **Logo / brand** — RedPath sub-brand (PodcastForge by RedPath), or a clean standalone identity?
4. **Default voices** — confirm `eve`+`ara` is the right opening pairing, or do you want to A/B with `eve`+`leo` / `ara`+`rex`?
5. **Source size ceiling** — should we hard-cap input at, say, 100K characters, or let users paste novels and silently summarize first?

---

# Appendix A — Sample Generated Output

Illustrative target output for the two-host mode. This is the kind of script the prompt above is designed to produce. Used for QA — if generated scripts don't have this shape, the prompt needs another iteration.

```json
{
  "title": "The CF-FDE Bet: Why Embedded Senior Engineers Beat Pods",
  "estimated_duration_seconds": 612,
  "turns": [
    {
      "id": "t1",
      "speaker": "A",
      "text": "So I read the CF-FDE proposal last night. And I have to say... I was not expecting the team size."
    },
    {
      "id": "t2",
      "speaker": "B",
      "text": "[chuckle] You mean small."
    },
    {
      "id": "t3",
      "speaker": "A",
      "text": "Small. Like, suspiciously small. Four-week sprints, two or three engineers, embedded straight into the business function. That's it?"
    },
    {
      "id": "t4",
      "speaker": "B",
      "text": "That's the whole bet. The argument is that the bottleneck for agentic AI in corporate functions isn't capacity. It's <emphasis>context</emphasis>. You don't need ten engineers - you need two who actually understand the workflow they're automating."
    },
    {
      "id": "t5",
      "speaker": "A",
      "text": "Okay but [pause] every PMO in the world will look at that and say 'where's the project plan'."
    },
    {
      "id": "t6",
      "speaker": "B",
      "text": "Right. And that's exactly why it's structured as a sprint, not a program. Four weeks, fixed end date, ship something or kill it."
    }
  ]
}
```

---

# Appendix B — Project Folder Structure

```
podcastforge/
├── client/                       # Vite + React app
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── routes/
│   │   │   ├── SourceScreen.tsx
│   │   │   ├── EditorScreen.tsx
│   │   │   └── RenderScreen.tsx
│   │   ├── components/
│   │   │   ├── TurnCard.tsx
│   │   │   ├── TagToolbar.tsx
│   │   │   ├── VoicePicker.tsx
│   │   │   └── ProgressList.tsx
│   │   ├── store/
│   │   │   └── projectStore.ts   # zustand
│   │   ├── lib/
│   │   │   ├── grokClient.ts     # fetch wrappers for /api/*
│   │   │   ├── audio/
│   │   │   │   ├── decode.ts
│   │   │   │   ├── stitch.ts
│   │   │   │   ├── trimSilence.ts
│   │   │   │   └── encodeMp3.ts
│   │   │   ├── pdf.ts            # pdfjs-dist wrapper
│   │   │   └── tagLinter.ts      # validates speech tags
│   │   └── prompts/              # mirrored copies for client display
│   ├── index.html
│   ├── tailwind.config.ts
│   └── vite.config.ts
├── server/                       # Express proxy
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   │   ├── generateScript.ts
│   │   │   ├── tts.ts
│   │   │   └── health.ts
│   │   ├── prompts/
│   │   │   ├── twoHost.ts
│   │   │   └── solo.ts
│   │   └── lib/
│   │       ├── xaiClient.ts
│   │       └── rateLimit.ts
├── shared/                       # types shared between client/server
│   └── types.ts
├── .env.example
├── docker-compose.yml            # for local dev
└── README.md
```

---

<div align="center">

*— End of Specification —*

</div>
