import type {
  AudioQuality,
  Script,
  VoiceId,
} from "../../../shared/types.js";
import { AUDIO_QUALITY_MAP } from "../../../shared/types.js";

const XAI_BASE = "https://api.x.ai/v1";
const SCRIPT_MODEL = process.env.XAI_SCRIPT_MODEL || "grok-4.3";

function getApiKey(): string {
  const key = process.env.XAI_API_KEY;
  if (!key) {
    throw new Error("XAI_API_KEY is not set in environment");
  }
  return key;
}

// ===== Script generation (chat completions, JSON mode) =====
export async function generateScript(args: {
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
}): Promise<Script> {
  const res = await fetch(`${XAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: SCRIPT_MODEL,
      messages: [
        { role: "system", content: args.systemPrompt },
        { role: "user", content: args.userMessage },
      ],
      response_format: { type: "json_object" },
      // Default 0.85 for content (pass 1). Pass 2 humanize wants more
      // spontaneity in word choice — callers can override.
      temperature: args.temperature ?? 0.85,
    }),
    // 120s for long scripts on grok-4.3
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "<no body>");
    throw new Error(`xAI chat error ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("xAI returned no content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error(
      `Failed to parse JSON from model: ${(e as Error).message}\nRaw: ${content.slice(0, 400)}`
    );
  }

  // Normalize: model may emit estimated_duration_seconds (snake) or camelCase.
  const obj = parsed as Record<string, unknown>;
  const turnsRaw = obj.turns as Array<Record<string, unknown>> | undefined;
  if (!turnsRaw || !Array.isArray(turnsRaw) || turnsRaw.length === 0) {
    throw new Error("Model output missing 'turns' array");
  }

  const turns = turnsRaw.map((t, i) => ({
    id: typeof t.id === "string" ? t.id : `t${i + 1}`,
    speaker: (t.speaker === "A" || t.speaker === "B" || t.speaker === "N"
      ? t.speaker
      : "A") as "A" | "B" | "N",
    text: String(t.text || "").trim(),
  }));

  const script: Script = {
    title: String(obj.title || "Untitled Episode"),
    estimatedDurationSeconds: Number(
      obj.estimated_duration_seconds || obj.estimatedDurationSeconds || 0
    ),
    turns,
  };

  return script;
}

// ===== TTS =====
export async function synthesize(args: {
  text: string;
  voiceId: VoiceId;
  language?: string;
  audioQuality: AudioQuality;
}): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  const output_format = AUDIO_QUALITY_MAP[args.audioQuality];

  const res = await fetch(`${XAI_BASE}/tts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: args.text,
      voice_id: args.voiceId,
      language: args.language || "en",
      output_format,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "<no body>");
    throw new Error(`xAI TTS error ${res.status}: ${body.slice(0, 500)}`);
  }

  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") || "audio/mpeg";
  return { buffer, contentType };
}

// ===== Health ping (used by /api/health/deep) =====
export async function xaiPing(): Promise<{
  ok: boolean;
  latencyMs: number;
  modelsAvailable?: number;
  error?: string;
}> {
  const started = Date.now();
  try {
    const res = await fetch(`${XAI_BASE}/models`, {
      method: "GET",
      headers: { Authorization: `Bearer ${getApiKey()}` },
      signal: AbortSignal.timeout(5_000),
    });
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      const body = await res.text().catch(() => "<no body>");
      return {
        ok: false,
        latencyMs,
        error: `xAI ${res.status}: ${body.slice(0, 200)}`,
      };
    }
    const data = (await res.json()) as { data?: unknown[] };
    return {
      ok: true,
      latencyMs,
      modelsAvailable: Array.isArray(data?.data) ? data.data.length : undefined,
    };
  } catch (e) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: (e as Error).message,
    };
  }
}
