import type { ProjectConfig, Turn } from "../../../shared/types.js";

function formatTurns(turns: Turn[]): string {
  if (turns.length === 0) return "(none)";
  return turns
    .map((t) => `Speaker ${t.speaker}: ${t.text}`)
    .join("\n\n");
}

export function buildRegeneratePrompt(args: {
  turn: Turn;
  precedingTurns: Turn[];
  followingTurns: Turn[];
  hint?: string;
  config: ProjectConfig;
}): { system: string; user: string } {
  const system = `You are revising one turn in an existing podcast script. Maintain the
established voice, tone, and conversational flow. Match the speaker's
character (A=curious lead, B=warm explainer, or N=solo narrator).

Rules:
- Keep the same speaker unless the user explicitly asks to change it.
- Speech tags: use sparingly, max 3 per turn, only where natural.
- Supported inline tags: [pause] [long-pause] [hum-tune] [laugh] [chuckle] [giggle] [cry] [tsk] [tongue-click] [lip-smack] [breath] [inhale] [exhale] [sigh]
- Supported wrap tags: <soft> <whisper> <loud> <build-intensity> <decrease-intensity> <higher-pitch> <lower-pitch> <slow> <fast> <sing-song> <singing> <laugh-speak> <emphasis>
- BANNED phrases: "delve into", "let's unpack", "fascinating", "it's important to note", "in today's fast-paced world", "buckle up", "dive deep", "at the end of the day".
- Tone: ${args.config.tone}
- Audience: ${args.config.audience}

Return ONLY a JSON object: { "speaker": "A"|"B"|"N", "text": "..." }
No preamble, no markdown fences.`;

  const user = `PRECEDING TURNS:
${formatTurns(args.precedingTurns)}

CURRENT TURN (revise this):
Speaker ${args.turn.speaker}: ${args.turn.text}

FOLLOWING TURNS:
${formatTurns(args.followingTurns)}

USER GUIDANCE: ${args.hint || "Make it more natural / shorter / tighter."}

Return JSON: { "speaker": "...", "text": "..." }`;

  return { system, user };
}
