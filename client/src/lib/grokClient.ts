import type {
  AudioQuality,
  GenerateScriptRequest,
  GenerateScriptResponse,
  ProjectConfig,
  Script,
  VoiceId,
} from "@shared/types";

export async function generateScriptApi(args: {
  config: ProjectConfig;
  source: { title?: string; rawText: string };
}): Promise<Script> {
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
  return data.script;
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
