import { z } from "zod";

// ===== Zod schemas for PodcastForge project validation =====

export const SpeakerSchema = z.enum(["A", "B", "N"]);

export const VoiceIdSchema = z.string().min(1);

export const TurnSchema = z.object({
  id: z.string(),
  speaker: SpeakerSchema,
  text: z.string(),
  voiceOverride: VoiceIdSchema.optional(),
});

export const ScriptSchema = z.object({
  title: z.string(),
  estimatedDurationSeconds: z.number(),
  turns: z.array(TurnSchema).min(1),
});

export const ProjectConfigSchema = z.object({
  mode: z.enum(["two-host", "solo"]),
  length: z.enum(["short", "medium", "long"]),
  tone: z.enum(["casual", "professional", "energetic", "documentary"]),
  audience: z.enum(["general", "technical", "executive"]),
  focusPrompt: z.string().optional(),
  voices: z.object({
    A: VoiceIdSchema,
    B: VoiceIdSchema.optional(),
    N: VoiceIdSchema.optional(),
  }),
  audioQuality: z.enum(["standard", "high", "studio"]),
  pauseSpeakerSwitchMs: z.number(),
  pauseSameSpeakerMs: z.number(),
});

// The full shape of a .podcastforge.json export file
export const ProjectExportSchema = z.object({
  _format: z.literal("podcastforge").optional(),
  _version: z.literal("0.1.0").optional(),
  sourceTitle: z.string(),
  sourceText: z.string(),
  config: ProjectConfigSchema,
  script: ScriptSchema.nullable(),
});

export type ProjectExport = z.infer<typeof ProjectExportSchema>;
