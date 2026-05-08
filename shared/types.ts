// ===== Voice + audio =====
export type BuiltInVoice = "eve" | "ara" | "rex" | "sal" | "leo";
export type VoiceId = BuiltInVoice | string; // string = custom voice_id

export type AudioQuality = "standard" | "high" | "studio";

export const AUDIO_QUALITY_MAP: Record<
  AudioQuality,
  { sample_rate: number; bit_rate: number; codec: "mp3" }
> = {
  standard: { codec: "mp3", sample_rate: 24000, bit_rate: 128000 },
  high: { codec: "mp3", sample_rate: 44100, bit_rate: 192000 },
  studio: { codec: "mp3", sample_rate: 48000, bit_rate: 256000 },
};

export const VOICE_INFO: Record<
  BuiltInVoice,
  { label: string; vibe: string }
> = {
  eve: { label: "Eve", vibe: "Upbeat, conversational. Default lead." },
  ara: { label: "Ara", vibe: "Warm, friendly. Counterweight to Eve." },
  rex: { label: "Rex", vibe: "Business, presentational." },
  sal: { label: "Sal", vibe: "Versatile, balanced." },
  leo: { label: "Leo", vibe: "Authoritative, instructional." },
};

// ===== Script model =====
export type Speaker = "A" | "B" | "N";

export interface Turn {
  id: string;
  speaker: Speaker;
  text: string;
}

export interface Script {
  title: string;
  estimatedDurationSeconds: number;
  turns: Turn[];
}

// ===== Project config =====
export type Mode = "two-host" | "solo";
export type Length = "short" | "medium" | "long";
export type Tone = "casual" | "professional" | "energetic" | "documentary";
export type Audience = "general" | "technical" | "executive";

export interface ProjectConfig {
  mode: Mode;
  length: Length;
  tone: Tone;
  audience: Audience;
  focusPrompt?: string;
  voices: {
    A: VoiceId;
    B?: VoiceId;
    N?: VoiceId;
  };
  audioQuality: AudioQuality;
  pauseSpeakerSwitchMs: number;
  pauseSameSpeakerMs: number;
}

// ===== Script linting =====
export interface LintWarning {
  turnId: string;
  type: "tag-count" | "unclosed-tag" | "unknown-tag" | "banned-phrase";
  message: string;
}

// ===== API contracts =====
export interface GenerateScriptRequest {
  config: ProjectConfig;
  source: {
    title?: string;
    rawText: string;
  };
}

export interface GenerateScriptResponse {
  script: Script;
  lintWarnings?: LintWarning[];
  debugPrompt?: { system: string; user: string };
}

export interface RegenerateTurnRequest {
  turn: Turn;
  precedingTurns: Turn[];
  followingTurns: Turn[];
  hint?: string;
  config: ProjectConfig;
}

export interface RegenerateTurnResponse {
  turn: Turn;
}

export interface TtsRequest {
  text: string;
  voiceId: VoiceId;
  language?: string;
  audioQuality: AudioQuality;
}

// /api/tts returns raw audio bytes (Content-Type: audio/mpeg), not JSON.

export interface ApiError {
  error: string;
  details?: string;
}
