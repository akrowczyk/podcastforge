import type { ProjectConfig, Script, Turn } from "@shared/types";
import { AUDIO_QUALITY_MAP } from "@shared/types";
import { ttsApi } from "../grokClient";
import { pMap } from "../pMap";
import {
  concatMono,
  decodeMp3ToMono,
  silence,
  trimTrailingSilence,
} from "./decode";
import { encodeMp3 } from "./encodeMp3";

interface RenderCallbacks {
  onTurnStart?: (turnId: string) => void;
  onTurnDone?: (turnId: string, audioUrl: string) => void;
  onTurnError?: (turnId: string, error: string) => void;
}

interface RenderArgs {
  script: Script;
  config: ProjectConfig;
  // Optional cache of previously synthesized turn MP3 ArrayBuffers (keyed by turn id + text hash)
  cache?: Map<string, ArrayBuffer>;
  callbacks?: RenderCallbacks;
}

function voiceForTurn(turn: Turn, config: ProjectConfig): string {
  if (turn.voiceOverride) return turn.voiceOverride;
  if (turn.speaker === "A") return config.voices.A;
  if (turn.speaker === "B") return config.voices.B || config.voices.A;
  return config.voices.N || config.voices.A;
}

// Synthesize one turn — TTS → ArrayBuffer (raw MP3 bytes)
export async function synthesizeTurn(
  turn: Turn,
  config: ProjectConfig
): Promise<ArrayBuffer> {
  const voiceId = voiceForTurn(turn, config);
  return await ttsApi({
    text: turn.text,
    voiceId,
    audioQuality: config.audioQuality,
    language: "en",
  });
}

// Full episode render. Per-turn synth is concurrent (cap=4), stitch is sequential.
export async function renderEpisode(args: RenderArgs): Promise<{
  blob: Blob;
  url: string;
  durationSec: number;
}> {
  const { script, config, callbacks } = args;
  const sampleRate = AUDIO_QUALITY_MAP[config.audioQuality].sample_rate;
  const bitRateKbps = AUDIO_QUALITY_MAP[config.audioQuality].bit_rate / 1000;

  // 1. Synthesize all turns (concurrent)
  const turnAudio: { turn: Turn; bytes: ArrayBuffer }[] = await pMap(
    script.turns,
    async (turn) => {
      callbacks?.onTurnStart?.(turn.id);
      try {
        const cacheKey = `${turn.id}:${hashText(turn.text)}:${voiceForTurn(turn, config)}`;
        let bytes: ArrayBuffer;
        if (args.cache?.has(cacheKey)) {
          bytes = args.cache.get(cacheKey)!;
        } else {
          bytes = await synthesizeTurn(turn, config);
          args.cache?.set(cacheKey, bytes);
        }
        // Build a transient blob URL so the UI can preview-play this turn
        const url = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
        callbacks?.onTurnDone?.(turn.id, url);
        return { turn, bytes };
      } catch (e) {
        callbacks?.onTurnError?.(turn.id, (e as Error).message);
        throw e;
      }
    },
    4
  );

  // 2. Decode each turn to mono PCM at the target sample rate, trim trailing silence
  const trimmed: { turn: Turn; pcm: Float32Array }[] = [];
  for (const { turn, bytes } of turnAudio) {
    const pcm = await decodeMp3ToMono(bytes, sampleRate);
    const tight = trimTrailingSilence(pcm, -45, 30, sampleRate);
    trimmed.push({ turn, pcm: tight });
  }

  // 3. Stitch with inter-turn pauses. P8 — micro-turns (≤5 words after
  //    stripping speech tags) get a tight 100ms pause regardless of
  //    speaker so reactions like "Right." or "[chuckle] Yeah." land as
  //    interjections rather than polite turn-taking.
  const segments: Float32Array[] = [];
  for (let i = 0; i < trimmed.length; i++) {
    segments.push(trimmed[i].pcm);
    if (i < trimmed.length - 1) {
      const cur = trimmed[i].turn;
      const nxt = trimmed[i + 1].turn;
      const same = cur.speaker === nxt.speaker;
      const ms =
        isMicroTurn(cur) || isMicroTurn(nxt)
          ? 100
          : same
            ? config.pauseSameSpeakerMs
            : config.pauseSpeakerSwitchMs;
      segments.push(silence(ms, sampleRate));
    }
  }

  const merged = concatMono(segments);
  const durationSec = merged.length / sampleRate;

  // 4. Encode merged stream to MP3 (in a Web Worker so the main thread
  //    stays responsive). The merged buffer is transferred to the worker;
  //    we already captured durationSec above so we don't need it after.
  const blob = await encodeMp3(merged, sampleRate, bitRateKbps);
  const url = URL.createObjectURL(blob);
  return { blob, url, durationSec };
}

// Strip speech tags ([inline] and <wrap>...</wrap>) and count words.
// "[chuckle] Yeah." → 1 word, not 2.
function isMicroTurn(turn: Turn): boolean {
  const stripped = turn.text.replace(/\[[a-z-]+\]|<\/?[a-z-]+>/gi, "").trim();
  if (!stripped) return true;
  return stripped.split(/\s+/).filter(Boolean).length <= 5;
}

// Cheap hash for cache keys — not cryptographic, just for "did the text change"
function hashText(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}
