import type {
  AudioQuality,
  GenerateScriptRequest,
  GenerateScriptResponse,
  LintWarning,
  ProjectConfig,
  RegenerateTurnRequest,
  RegenerateTurnResponse,
  Script,
  Turn,
  VoiceId,
} from "@shared/types";

export interface GenerateResult {
  script: Script;
  lintWarnings: LintWarning[];
  debugPrompt?: { system: string; user: string };
}

export async function generateScriptApi(args: {
  config: ProjectConfig;
  source: { title?: string; rawText: string };
}): Promise<GenerateResult> {
  const body: GenerateScriptRequest = args;
  const res = await fetch("/api/generate-script", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.details || err.error || "Generation failed");
  }
  const data = (await res.json()) as GenerateScriptResponse;
  return {
    script: data.script,
    lintWarnings: data.lintWarnings || [],
    debugPrompt: data.debugPrompt,
  };
}

export async function regenerateTurnApi(args: {
  turn: Turn;
  precedingTurns: Turn[];
  followingTurns: Turn[];
  hint?: string;
  config: ProjectConfig;
}): Promise<Turn> {
  const body: RegenerateTurnRequest = args;
  const res = await fetch("/api/regenerate-turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ error: `Regeneration failed (${res.status})` }));
    throw new Error(err.details || err.error || "Regeneration failed");
  }
  const data = (await res.json()) as RegenerateTurnResponse;
  return data.turn;
}

export async function ttsApi(args: {
  text: string;
  voiceId: VoiceId;
  audioQuality: AudioQuality;
  language?: string;
}): Promise<ArrayBuffer> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ error: `TTS failed (${res.status})` }));
    throw new Error(err.details || err.error || "TTS failed");
  }
  return res.arrayBuffer();
}
