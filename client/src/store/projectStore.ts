import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ProjectConfig,
  Script,
  Turn,
  VoiceId,
} from "@shared/types";

interface TurnRender {
  state: "idle" | "rendering" | "done" | "failed";
  audioBlobUrl?: string;
  error?: string;
}

interface ProjectState {
  // Source
  sourceTitle: string;
  sourceText: string;

  // Config
  config: ProjectConfig;

  // Generated
  script: Script | null;

  // Per-turn render cache (keyed by turn id)
  turnRenders: Record<string, TurnRender>;

  // Final stitched output
  finalAudioUrl: string | null;
  finalRenderState: "idle" | "rendering" | "done" | "failed";
  finalRenderError?: string;

  // ===== Actions =====
  setSourceTitle: (t: string) => void;
  setSourceText: (t: string) => void;
  patchConfig: (p: Partial<ProjectConfig>) => void;
  setVoice: (slot: "A" | "B" | "N", voice: VoiceId) => void;

  setScript: (s: Script | null) => void;
  updateTurnText: (id: string, text: string) => void;

  setTurnRender: (id: string, render: TurnRender) => void;
  clearTurnRenders: () => void;

  setFinalAudio: (url: string | null) => void;
  setFinalRenderState: (
    state: "idle" | "rendering" | "done" | "failed",
    error?: string
  ) => void;

  resetProject: () => void;
}

const DEFAULT_CONFIG: ProjectConfig = {
  mode: "two-host",
  length: "medium",
  tone: "casual",
  audience: "general",
  voices: { A: "eve", B: "ara", N: "leo" },
  audioQuality: "high",
  pauseSpeakerSwitchMs: 250,
  pauseSameSpeakerMs: 150,
};

export const useProject = create<ProjectState>()(
  persist(
    (set) => ({
      sourceTitle: "",
      sourceText: "",
      config: DEFAULT_CONFIG,
      script: null,
      turnRenders: {},
      finalAudioUrl: null,
      finalRenderState: "idle",

      setSourceTitle: (t) => set({ sourceTitle: t }),
      setSourceText: (t) => set({ sourceText: t }),
      patchConfig: (p) =>
        set((s) => ({ config: { ...s.config, ...p } })),
      setVoice: (slot, voice) =>
        set((s) => ({
          config: { ...s.config, voices: { ...s.config.voices, [slot]: voice } },
        })),

      setScript: (script) =>
        set({ script, turnRenders: {}, finalAudioUrl: null, finalRenderState: "idle" }),

      updateTurnText: (id, text) =>
        set((s) => {
          if (!s.script) return {};
          const turns: Turn[] = s.script.turns.map((t) =>
            t.id === id ? { ...t, text } : t
          );
          // Invalidate the cached render for this turn
          const newRenders = { ...s.turnRenders };
          delete newRenders[id];
          return {
            script: { ...s.script, turns },
            turnRenders: newRenders,
            finalAudioUrl: null,
            finalRenderState: "idle",
          };
        }),

      setTurnRender: (id, render) =>
        set((s) => ({ turnRenders: { ...s.turnRenders, [id]: render } })),

      clearTurnRenders: () => set({ turnRenders: {} }),

      setFinalAudio: (url) => set({ finalAudioUrl: url }),
      setFinalRenderState: (state, error) =>
        set({ finalRenderState: state, finalRenderError: error }),

      resetProject: () =>
        set({
          sourceTitle: "",
          sourceText: "",
          config: DEFAULT_CONFIG,
          script: null,
          turnRenders: {},
          finalAudioUrl: null,
          finalRenderState: "idle",
          finalRenderError: undefined,
        }),
    }),
    {
      name: "podcastforge.project.v1",
      // Don't persist blob URLs — they don't survive reloads
      partialize: (state) => ({
        sourceTitle: state.sourceTitle,
        sourceText: state.sourceText,
        config: state.config,
        script: state.script,
      }),
    }
  )
);
