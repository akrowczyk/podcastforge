import type { ProjectConfig, Script } from "../../../shared/types.js";
import { generateScript } from "./xaiClient.js";
import {
  buildHumanizeSystemPrompt,
  buildHumanizeUserMessage,
} from "../prompts/humanize.js";

export interface HumanizeDebugPrompt {
  system: string;
  user: string;
}

export interface HumanizeResult {
  script: Script;
  debugPrompt: HumanizeDebugPrompt;
}

export async function runHumanizePass(
  baseScript: Script,
  config: ProjectConfig
): Promise<HumanizeResult> {
  const systemPrompt = buildHumanizeSystemPrompt(config);
  const userMessage = buildHumanizeUserMessage({
    script: baseScript,
    config,
  });

  // Higher temperature on pass 2 — we want spontaneity in word choice
  // and reaction variety, not the tighter content-faithfulness of pass 1.
  const humanized = await generateScript({
    systemPrompt,
    userMessage,
    temperature: 0.92,
  });

  // Coerce speaker types per mode (same logic as /api/generate-script).
  if (config.mode === "solo") {
    humanized.turns = humanized.turns.map((t) => ({ ...t, speaker: "N" }));
  } else {
    humanized.turns = humanized.turns.map((t) => ({
      ...t,
      speaker: t.speaker === "N" ? "A" : t.speaker,
    }));
  }

  // Renumber IDs sequentially in case the model didn't.
  humanized.turns = humanized.turns.map((t, i) => ({
    ...t,
    id: `t${i + 1}`,
  }));

  // Preserve the input title if the model decided to rewrite it.
  humanized.title = baseScript.title || humanized.title;

  return {
    script: humanized,
    debugPrompt: { system: systemPrompt, user: userMessage },
  };
}

export function shouldHumanize(config: ProjectConfig): boolean {
  return (
    config.mode === "two-host" &&
    (config.tone === "casual" || config.tone === "energetic")
  );
}
