import type { Turn, LintWarning } from "../../../shared/types.js";

// ===== Supported Grok TTS tags =====
const INLINE_TAGS = new Set([
  "pause",
  "long-pause",
  "hum-tune",
  "laugh",
  "chuckle",
  "giggle",
  "cry",
  "tsk",
  "tongue-click",
  "lip-smack",
  "breath",
  "inhale",
  "exhale",
  "sigh",
]);

const WRAP_TAGS = new Set([
  "soft",
  "whisper",
  "loud",
  "build-intensity",
  "decrease-intensity",
  "higher-pitch",
  "lower-pitch",
  "slow",
  "fast",
  "sing-song",
  "singing",
  "laugh-speak",
  "emphasis",
]);

// ===== Banned phrases =====
const BANNED_PHRASES = [
  "delve into",
  "let's unpack",
  "fascinating",
  "it's important to note",
  "in today's fast-paced world",
  "buckle up",
  "dive deep",
  "at the end of the day",
];

// ===== Tag counting helpers =====

/** Match [inline-tags] */
const RE_INLINE = /\[([a-z-]+)\]/gi;

/** Match <open-tags> (not closing tags) */
const RE_WRAP_OPEN = /<([a-z-]+)>/gi;

/** Match </close-tags> */
const RE_WRAP_CLOSE = /<\/([a-z-]+)>/gi;

function countTags(text: string): {
  total: number;
  inlineTags: string[];
  wrapOpenTags: string[];
  wrapCloseTags: string[];
} {
  const inlineTags: string[] = [];
  const wrapOpenTags: string[] = [];
  const wrapCloseTags: string[] = [];

  for (const m of text.matchAll(RE_INLINE)) {
    inlineTags.push(m[1].toLowerCase());
  }
  for (const m of text.matchAll(RE_WRAP_OPEN)) {
    wrapOpenTags.push(m[1].toLowerCase());
  }
  for (const m of text.matchAll(RE_WRAP_CLOSE)) {
    wrapCloseTags.push(m[1].toLowerCase());
  }

  return {
    total: inlineTags.length + wrapOpenTags.length,
    inlineTags,
    wrapOpenTags,
    wrapCloseTags,
  };
}

// ===== Lint a single turn =====

function lintTurn(turn: Turn): LintWarning[] {
  const warnings: LintWarning[] = [];
  const { total, inlineTags, wrapOpenTags, wrapCloseTags } = countTags(
    turn.text
  );

  // P2.1a — Tag count
  if (total > 3) {
    warnings.push({
      turnId: turn.id,
      type: "tag-count",
      message: `Turn has ${total} tags (max 3). Text: "${turn.text.slice(0, 80)}…"`,
    });
  }

  // P2.1b — Unclosed wrap tags
  const openCounts = new Map<string, number>();
  const closeCounts = new Map<string, number>();
  for (const t of wrapOpenTags)
    openCounts.set(t, (openCounts.get(t) || 0) + 1);
  for (const t of wrapCloseTags)
    closeCounts.set(t, (closeCounts.get(t) || 0) + 1);

  for (const [tag, count] of openCounts) {
    const closes = closeCounts.get(tag) || 0;
    if (closes < count) {
      warnings.push({
        turnId: turn.id,
        type: "unclosed-tag",
        message: `Unclosed <${tag}> tag (${count} opens, ${closes} closes)`,
      });
    }
  }

  // P2.1c — Unknown tags
  for (const tag of inlineTags) {
    if (!INLINE_TAGS.has(tag)) {
      warnings.push({
        turnId: turn.id,
        type: "unknown-tag",
        message: `Unknown inline tag [${tag}] — not in Grok TTS supported set`,
      });
    }
  }
  for (const tag of wrapOpenTags) {
    if (!WRAP_TAGS.has(tag)) {
      warnings.push({
        turnId: turn.id,
        type: "unknown-tag",
        message: `Unknown wrap tag <${tag}> — not in Grok TTS supported set`,
      });
    }
  }

  // P2.2 — Banned phrases
  const lowerText = turn.text.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lowerText.includes(phrase)) {
      warnings.push({
        turnId: turn.id,
        type: "banned-phrase",
        message: `Banned phrase detected: "${phrase}"`,
      });
    }
  }

  return warnings;
}

// ===== Lint an entire script =====

export function lintScript(turns: Turn[]): LintWarning[] {
  const warnings: LintWarning[] = [];
  for (const turn of turns) {
    warnings.push(...lintTurn(turn));
  }
  return warnings;
}
