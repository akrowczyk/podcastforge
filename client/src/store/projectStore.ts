import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  DebugPrompts,
  LintWarning,
  ProjectConfig,
  Script,
  Speaker,
  Turn,
  VoiceId,
} from "@shared/types";
import { ProjectExportSchema } from "../lib/schema";

interface TurnRender {
  state: "idle" | "rendering" | "done" | "failed";
  audioBlobUrl?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

interface ProjectState {
  // Source
  sourceTitle: string;
  sourceText: string;

  // Config
  config: ProjectConfig;

  // Generated
  script: Script | null;

  // P2: Lint warnings from script generation
  lintWarnings: LintWarning[];

  // P2/P8: Debug prompts (what was sent to Grok). Pass 1 is the base
  // generation prompt; pass 2 is the optional humanize prompt.
  debugPrompts: DebugPrompts | null;

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
  replaceTurn: (id: string, turn: Turn) => void;

  // P3.1: Turn management
  insertTurn: (afterId: string | null, speaker: Speaker) => void;
  duplicateTurn: (id: string) => void;
  deleteTurn: (id: string) => void;
  moveTurn: (id: string, direction: "up" | "down") => void;

  // P3.2: Bulk swap
  swapAllSpeakers: () => void;

  // P3.4: Per-turn voice override
  setTurnVoiceOverride: (id: string, voice: VoiceId | undefined) => void;

  // P3.5: Export / Import
  exportProject: () => string;
  importProject: (json: string) => { ok: boolean; error?: string };

  setLintWarnings: (w: LintWarning[]) => void;
  setDebugPrompts: (p: DebugPrompts | null) => void;

  setTurnRender: (id: string, render: Partial<TurnRender>) => void;
  clearTurnRenders: () => void;

  setFinalAudio: (url: string | null) => void;
  setFinalRenderState: (
    state: "idle" | "rendering" | "done" | "failed",
    error?: string
  ) => void;

  theme: "dark" | "light";
  toggleTheme: () => void;

  resetProject: () => void;
}

const DEFAULT_CONFIG: ProjectConfig = {
  mode: "two-host",
  length: "medium",
  tone: "casual",
  audience: "general",
  voices: { A: "eve", B: "ara", N: "leo" },
  audioQuality: "high",
  // P8 — tight conversational pauses. The variable micro-turn override
  // (~100ms) lives in render.ts; these are the substantive defaults.
  pauseSpeakerSwitchMs: 130,
  pauseSameSpeakerMs: 80,
};

function newTurnId(): string {
  return `t${Date.now()}`;
}

export const useProject = create<ProjectState>()(
  persist(
    (set, get) => ({
      sourceTitle: "",
      sourceText: "",
      config: DEFAULT_CONFIG,
      script: null,
      lintWarnings: [],
      debugPrompts: null,
      turnRenders: {},
      finalAudioUrl: null,
      finalRenderState: "idle",
      theme: "dark",

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

      replaceTurn: (id, turn) =>
        set((s) => {
          if (!s.script) return {};
          const turns: Turn[] = s.script.turns.map((t) =>
            t.id === id ? { ...turn, id } : t
          );
          const newRenders = { ...s.turnRenders };
          delete newRenders[id];
          return {
            script: { ...s.script, turns },
            turnRenders: newRenders,
            finalAudioUrl: null,
            finalRenderState: "idle",
          };
        }),

      // P3.1 — Turn management

      insertTurn: (afterId, speaker) =>
        set((s) => {
          if (!s.script) return {};
          const newTurn: Turn = { id: newTurnId(), speaker, text: "" };
          const turns = [...s.script.turns];
          if (afterId === null) {
            turns.unshift(newTurn);
          } else {
            const idx = turns.findIndex((t) => t.id === afterId);
            turns.splice(idx + 1, 0, newTurn);
          }
          return {
            script: { ...s.script, turns },
            finalAudioUrl: null,
            finalRenderState: "idle",
          };
        }),

      duplicateTurn: (id) =>
        set((s) => {
          if (!s.script) return {};
          const idx = s.script.turns.findIndex((t) => t.id === id);
          if (idx === -1) return {};
          const orig = s.script.turns[idx];
          const dup: Turn = { ...orig, id: newTurnId() };
          const turns = [...s.script.turns];
          turns.splice(idx + 1, 0, dup);
          return {
            script: { ...s.script, turns },
            finalAudioUrl: null,
            finalRenderState: "idle",
          };
        }),

      deleteTurn: (id) =>
        set((s) => {
          if (!s.script) return {};
          const turns = s.script.turns.filter((t) => t.id !== id);
          const newRenders = { ...s.turnRenders };
          delete newRenders[id];
          return {
            script: { ...s.script, turns },
            turnRenders: newRenders,
            finalAudioUrl: null,
            finalRenderState: "idle",
          };
        }),

      moveTurn: (id, direction) =>
        set((s) => {
          if (!s.script) return {};
          const turns = [...s.script.turns];
          const idx = turns.findIndex((t) => t.id === id);
          if (idx === -1) return {};
          const swapIdx = direction === "up" ? idx - 1 : idx + 1;
          if (swapIdx < 0 || swapIdx >= turns.length) return {};
          [turns[idx], turns[swapIdx]] = [turns[swapIdx], turns[idx]];
          return {
            script: { ...s.script, turns },
            finalAudioUrl: null,
            finalRenderState: "idle",
          };
        }),

      // P3.2 — Bulk speaker swap

      swapAllSpeakers: () =>
        set((s) => {
          if (!s.script) return {};
          const turns = s.script.turns.map((t) => ({
            ...t,
            speaker: (t.speaker === "A" ? "B" : t.speaker === "B" ? "A" : t.speaker) as Speaker,
          }));
          return {
            script: { ...s.script, turns },
            turnRenders: {},  // Invalidate all caches — voices changed
            finalAudioUrl: null,
            finalRenderState: "idle",
          };
        }),

      // P3.4 — Per-turn voice override

      setTurnVoiceOverride: (id, voice) =>
        set((s) => {
          if (!s.script) return {};
          const turns = s.script.turns.map((t) =>
            t.id === id ? { ...t, voiceOverride: voice } : t
          );
          // Invalidate cached audio for this turn — voice changed
          const newRenders = { ...s.turnRenders };
          delete newRenders[id];
          return {
            script: { ...s.script, turns },
            turnRenders: newRenders,
            finalAudioUrl: null,
            finalRenderState: "idle",
          };
        }),

      // P3.5 — Export / Import

      exportProject: () => {
        const s = get();
        return JSON.stringify(
          {
            _format: "podcastforge",
            _version: "0.1.0",
            sourceTitle: s.sourceTitle,
            sourceText: s.sourceText,
            config: s.config,
            script: s.script,
          },
          null,
          2
        );
      },

      importProject: (json: string) => {
        try {
          const raw = JSON.parse(json);
          const result = ProjectExportSchema.safeParse(raw);
          if (!result.success) {
            const msg = result.error.issues
              .map((i: { path: PropertyKey[]; message: string }) => `${i.path.join(".")}: ${i.message}`)
              .join("; ");
            return { ok: false, error: `Validation failed: ${msg}` };
          }
          const data = result.data;
          set({
            sourceTitle: data.sourceTitle,
            sourceText: data.sourceText,
            config: data.config as ProjectConfig,
            script: data.script as Script | null,
            turnRenders: {},
            finalAudioUrl: null,
            finalRenderState: "idle",
            lintWarnings: [],
            debugPrompts: null,
          });
          return { ok: true };
        } catch (e) {
          return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
        }
      },

      setLintWarnings: (lintWarnings) => set({ lintWarnings }),
      setDebugPrompts: (debugPrompts) => set({ debugPrompts }),

      setTurnRender: (id, render) =>
        set((s) => ({ turnRenders: { ...s.turnRenders, [id]: { ...s.turnRenders[id], ...render } } })),

      clearTurnRenders: () => set({ turnRenders: {} }),

      setFinalAudio: (url) => set({ finalAudioUrl: url }),
      setFinalRenderState: (state, error) =>
        set({ finalRenderState: state, finalRenderError: error }),

      toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),

      resetProject: () =>
        set({
          sourceTitle: "",
          sourceText: "",
          config: DEFAULT_CONFIG,
          script: null,
          lintWarnings: [],
          debugPrompts: null,
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
        theme: state.theme,
      }),
    }
  )
);
