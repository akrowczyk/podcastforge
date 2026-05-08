import { useRef, useState } from "react";
import type { LintWarning, Turn, BuiltInVoice } from "@shared/types";
import { VOICE_INFO } from "@shared/types";
import { useProject } from "../store/projectStore";
import { synthesizeTurn } from "../lib/audio/render";
import { regenerateTurnApi } from "../lib/grokClient";

const TAGS_INLINE = ["[pause]", "[laugh]", "[chuckle]", "[sigh]", "[breath]"];
const TAGS_WRAP = [
  { open: "<emphasis>", close: "</emphasis>", label: "<emphasis>" },
  { open: "<whisper>", close: "</whisper>", label: "<whisper>" },
  { open: "<slow>", close: "</slow>", label: "<slow>" },
  { open: "<soft>", close: "</soft>", label: "<soft>" },
];

// Full tag reference for the ⓘ popover
const TAG_REFERENCE = {
  inline: [
    { tag: "[pause]", desc: "Brief beat before something significant" },
    { tag: "[long-pause]", desc: "Longer dramatic pause" },
    { tag: "[laugh]", desc: "Genuine laughter" },
    { tag: "[chuckle]", desc: "Mild, brief amusement" },
    { tag: "[giggle]", desc: "Light, playful laugh" },
    { tag: "[sigh]", desc: "Exhalation expressing emotion" },
    { tag: "[breath]", desc: "Audible breath" },
    { tag: "[inhale]", desc: "Audible inhale" },
    { tag: "[exhale]", desc: "Audible exhale" },
    { tag: "[cry]", desc: "Emotional crying" },
    { tag: "[tsk]", desc: "Disapproving tongue click" },
    { tag: "[tongue-click]", desc: "Tongue click sound" },
    { tag: "[lip-smack]", desc: "Lip smacking sound" },
    { tag: "[hum-tune]", desc: "Humming a tune" },
  ],
  wrap: [
    { tag: "<emphasis>", desc: "Stress the wrapped word" },
    { tag: "<whisper>", desc: "Whispered aside" },
    { tag: "<soft>", desc: "Softer, quieter tone" },
    { tag: "<loud>", desc: "Louder, raised voice" },
    { tag: "<slow>", desc: "Slower pacing" },
    { tag: "<fast>", desc: "Faster pacing" },
    { tag: "<higher-pitch>", desc: "Higher vocal pitch" },
    { tag: "<lower-pitch>", desc: "Lower vocal pitch" },
    { tag: "<build-intensity>", desc: "Gradually increasing intensity" },
    { tag: "<decrease-intensity>", desc: "Gradually decreasing intensity" },
    { tag: "<sing-song>", desc: "Melodic, sing-song quality" },
    { tag: "<singing>", desc: "Actual singing" },
    { tag: "<laugh-speak>", desc: "Speaking while laughing" },
  ],
};

const VOICE_OPTIONS: BuiltInVoice[] = ["eve", "ara", "rex", "sal", "leo"];

interface Props {
  turn: Turn;
  index: number;
  allTurns: Turn[];
  lintWarnings: LintWarning[];
  isFirst: boolean;
  isLast: boolean;
  onSwapSpeaker: () => void;
  onMove: (direction: "up" | "down") => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export default function TurnCard({
  turn,
  index,
  allTurns,
  lintWarnings,
  isFirst,
  isLast,
  onSwapSpeaker,
  onMove,
  onDuplicate,
  onDelete,
}: Props) {
  const { config, updateTurnText, replaceTurn, setTurnVoiceOverride, turnRenders, setTurnRender } =
    useProject();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [previewing, setPreviewing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Regenerate state
  const [showRegenPopover, setShowRegenPopover] = useState(false);
  const [regenHint, setRegenHint] = useState("");
  const [regenerating, setRegenerating] = useState(false);

  // Tag reference popover
  const [showTagRef, setShowTagRef] = useState(false);

  // Voice override picker
  const [showVoicePicker, setShowVoicePicker] = useState(false);

  const render = turnRenders[turn.id];
  const speakerLabel =
    turn.speaker === "A" ? "EVE" : turn.speaker === "B" ? "ARA" : "NARRATOR";
  const speakerLetter =
    turn.speaker === "A" ? "A" : turn.speaker === "B" ? "B" : "N";

  function insertAtCursor(text: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newText = ta.value.slice(0, start) + text + ta.value.slice(end);
    updateTurnText(turn.id, newText);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + text.length, start + text.length);
    });
  }

  function wrapSelection(open: string, close: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = ta.value.slice(start, end);
    const replacement = sel ? `${open}${sel}${close}` : `${open}${close}`;
    const newText =
      ta.value.slice(0, start) + replacement + ta.value.slice(end);
    updateTurnText(turn.id, newText);
    requestAnimationFrame(() => {
      ta.focus();
      const cursor = sel ? start + replacement.length : start + open.length;
      ta.setSelectionRange(cursor, cursor);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Cmd+E / Ctrl+E → wrap selection in <emphasis>
    if ((e.metaKey || e.ctrlKey) && e.key === "e") {
      e.preventDefault();
      wrapSelection("<emphasis>", "</emphasis>");
    }
  }

  async function handlePreview() {
    if (previewing) return;
    setPreviewing(true);
    try {
      let url = render?.audioBlobUrl;
      if (!url) {
        setTurnRender(turn.id, { state: "rendering" });
        const bytes = await synthesizeTurn(turn, config);
        url = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
        setTurnRender(turn.id, { state: "done", audioBlobUrl: url });
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPreviewing(false);
      audio.onerror = () => setPreviewing(false);
      await audio.play();
    } catch (e) {
      setTurnRender(turn.id, {
        state: "failed",
        error: (e as Error).message,
      });
      setPreviewing(false);
    }
  }

  function handleStop() {
    audioRef.current?.pause();
    audioRef.current = null;
    setPreviewing(false);
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const turnIndex = allTurns.findIndex((t) => t.id === turn.id);
      const precedingTurns = allTurns.slice(
        Math.max(0, turnIndex - 3),
        turnIndex
      );
      const followingTurns = allTurns.slice(turnIndex + 1, turnIndex + 4);

      const newTurn = await regenerateTurnApi({
        turn,
        precedingTurns,
        followingTurns,
        hint: regenHint.trim() || undefined,
        config,
      });

      replaceTurn(turn.id, newTurn);
      setShowRegenPopover(false);
      setRegenHint("");
    } catch (e) {
      setTurnRender(turn.id, {
        state: "failed",
        error: `Regen: ${(e as Error).message}`,
      });
    } finally {
      setRegenerating(false);
    }
  }

  const charCount = turn.text.length;
  const tagCount = (turn.text.match(/\[[a-z-]+\]|<[a-z-]+>/gi) || []).length;
  const tagWarn = tagCount > 3;

  const hasTagWarnings = lintWarnings.some(
    (w) => w.type === "tag-count" || w.type === "unclosed-tag" || w.type === "unknown-tag"
  );
  const hasPhraseWarnings = lintWarnings.some(
    (w) => w.type === "banned-phrase"
  );

  const overrideLabel = turn.voiceOverride
    ? VOICE_INFO[turn.voiceOverride as BuiltInVoice]?.label || turn.voiceOverride
    : null;

  return (
    <div
      className={[
        "group relative border bg-ink-900/40 transition-colors",
        turn.speaker === "A"
          ? "border-l-[3px] border-l-ink-50 border-y-ink-800 border-r-ink-800"
          : turn.speaker === "B"
          ? "border-l-[3px] border-l-ink-400 border-y-ink-800 border-r-ink-800"
          : "border-l-[3px] border-l-ink-600 border-y-ink-800 border-r-ink-800",
        render?.state === "failed" && "ring-1 ring-red-700",
      ].join(" ")}
    >
      {/* Turn management buttons — visible on hover */}
      <div className="absolute -right-0 top-1 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          onClick={() => onMove("up")}
          disabled={isFirst}
          className="w-6 h-6 flex items-center justify-center text-[10px] text-ink-500 hover:text-ink-50 hover:bg-ink-800 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          title="Move up"
        >↑</button>
        <button
          onClick={() => onMove("down")}
          disabled={isLast}
          className="w-6 h-6 flex items-center justify-center text-[10px] text-ink-500 hover:text-ink-50 hover:bg-ink-800 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          title="Move down"
        >↓</button>
        <button
          onClick={onDuplicate}
          className="w-6 h-6 flex items-center justify-center text-[10px] text-ink-500 hover:text-ink-50 hover:bg-ink-800 transition-colors"
          title="Duplicate"
        >⎘</button>
        <button
          onClick={onDelete}
          className="w-6 h-6 flex items-center justify-center text-[10px] text-red-700 hover:text-red-400 hover:bg-ink-800 transition-colors"
          title="Delete"
        >✕</button>
      </div>

      <div className="flex items-stretch">
        {/* Speaker column */}
        <button
          onClick={onSwapSpeaker}
          className="flex-shrink-0 w-20 flex flex-col items-center justify-center gap-1 border-r border-ink-800 hover:bg-ink-800 transition-colors"
          title="Click to swap speaker"
        >
          <div
            className={[
              "w-10 h-10 flex items-center justify-center font-display font-bold text-lg border",
              turn.speaker === "A"
                ? "bg-ink-50 text-ink-950 border-ink-50"
                : turn.speaker === "B"
                ? "bg-ink-950 text-ink-50 border-ink-50"
                : "bg-ink-950 text-ink-400 border-ink-600",
            ].join(" ")}
          >
            {speakerLetter}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-ink-500">
            {speakerLabel}
          </div>
          <div className="font-mono text-[9px] text-ink-700">#{index + 1}</div>
          {/* Voice override badge */}
          {overrideLabel && (
            <div className="font-mono text-[8px] uppercase tracking-wider text-amber-400 mt-0.5">
              {overrideLabel}
            </div>
          )}
        </button>

        {/* Text + toolbar column */}
        <div className="flex-1 p-4 pr-8">
          {/* Tag toolbar */}
          <div className="flex flex-wrap items-center gap-1 mb-2 opacity-50 group-hover:opacity-100 transition-opacity">
            {TAGS_INLINE.map((tag) => (
              <button
                key={tag}
                onClick={() => insertAtCursor(tag)}
                className="px-2 py-0.5 text-[10px] font-mono text-ink-400 hover:text-ink-50 hover:bg-ink-800 transition-colors"
              >
                {tag}
              </button>
            ))}
            <span className="text-ink-700 px-1">|</span>
            {TAGS_WRAP.map((tag) => (
              <button
                key={tag.label}
                onClick={() => wrapSelection(tag.open, tag.close)}
                className="px-2 py-0.5 text-[10px] font-mono text-ink-400 hover:text-ink-50 hover:bg-ink-800 transition-colors"
              >
                {tag.label}
              </button>
            ))}
            <span className="text-ink-700 px-1">|</span>
            {/* Tag reference button */}
            <div className="relative">
              <button
                onClick={() => setShowTagRef(!showTagRef)}
                className="px-1.5 py-0.5 text-[10px] font-mono text-ink-500 hover:text-ink-50 hover:bg-ink-800 transition-colors"
                title="Tag reference"
              >
                ⓘ
              </button>
              {showTagRef && (
                <div className="absolute top-full left-0 mt-1 w-80 bg-ink-950 border border-ink-700 p-3 z-30 shadow-xl max-h-80 overflow-auto">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-2">
                    Inline tags
                  </div>
                  {TAG_REFERENCE.inline.map((t) => (
                    <div key={t.tag} className="flex gap-2 mb-1 font-mono text-[10px]">
                      <span className="text-ink-200 shrink-0 w-24">{t.tag}</span>
                      <span className="text-ink-500">{t.desc}</span>
                    </div>
                  ))}
                  <div className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-2 mt-3">
                    Wrap tags
                  </div>
                  {TAG_REFERENCE.wrap.map((t) => (
                    <div key={t.tag} className="flex gap-2 mb-1 font-mono text-[10px]">
                      <span className="text-ink-200 shrink-0 w-28">{t.tag}</span>
                      <span className="text-ink-500">{t.desc}</span>
                    </div>
                  ))}
                  <div className="mt-2 pt-2 border-t border-ink-800 font-mono text-[9px] text-ink-600">
                    Tip: Cmd+E wraps selection in &lt;emphasis&gt;
                  </div>
                </div>
              )}
            </div>
          </div>

          <textarea
            ref={textareaRef}
            value={turn.text}
            onChange={(e) => updateTurnText(turn.id, e.target.value)}
            onKeyDown={handleKeyDown}
            rows={Math.max(2, Math.ceil(turn.text.length / 90))}
            className="w-full bg-transparent border-0 outline-none font-sans text-[15px] leading-relaxed text-ink-100 resize-none placeholder:text-ink-700"
            placeholder="Enter turn text…"
          />

          {/* Per-turn lint warnings */}
          {lintWarnings.length > 0 && (
            <div className="mb-2 space-y-0.5">
              {lintWarnings.map((w, i) => (
                <div
                  key={i}
                  className={[
                    "font-mono text-[10px] px-2 py-0.5",
                    w.type === "banned-phrase"
                      ? "text-yellow-400/80"
                      : "text-amber-400/80",
                  ].join(" ")}
                >
                  ⚠ {w.message}
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-ink-800">
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-ink-500">
              <span>{charCount} chars</span>
              <span className={tagWarn || hasTagWarnings ? "text-amber-400" : ""}>
                {tagCount} tags{tagWarn ? " ⚠" : ""}
              </span>
              {hasPhraseWarnings && (
                <span className="text-yellow-400">phrase ⚠</span>
              )}
              {render?.state === "rendering" && (
                <span className="text-ink-400 animate-pulse-soft">
                  • synthesizing
                </span>
              )}
              {render?.state === "done" && (
                <span className="text-emerald-400">• cached</span>
              )}
              {render?.state === "failed" && (
                <span className="text-red-400">• {render.error}</span>
              )}
            </div>
            <div className="flex items-center gap-1 relative">
              {/* Voice override button */}
              <div className="relative">
                <button
                  onClick={() => setShowVoicePicker(!showVoicePicker)}
                  className={[
                    "px-2 py-1 text-[10px] font-mono uppercase tracking-widest border transition-colors",
                    turn.voiceOverride
                      ? "text-amber-400 border-amber-800 hover:border-amber-400"
                      : "text-ink-500 border-ink-800 hover:text-ink-50 hover:border-ink-50",
                  ].join(" ")}
                  title="Override voice for this turn"
                >
                  {turn.voiceOverride
                    ? VOICE_INFO[turn.voiceOverride as BuiltInVoice]?.label || turn.voiceOverride
                    : "Voice"}
                </button>
                {showVoicePicker && (
                  <div className="absolute bottom-full right-0 mb-1 bg-ink-950 border border-ink-700 p-2 z-20 shadow-xl">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-ink-500 mb-1.5">
                      Voice override
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {VOICE_OPTIONS.map((v) => (
                        <button
                          key={v}
                          onClick={() => {
                            setTurnVoiceOverride(turn.id, v);
                            setShowVoicePicker(false);
                          }}
                          className={[
                            "px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-left transition-colors",
                            turn.voiceOverride === v
                              ? "bg-ink-50 text-ink-950"
                              : "text-ink-300 hover:text-ink-50 hover:bg-ink-800",
                          ].join(" ")}
                        >
                          {VOICE_INFO[v].label}
                          <span className="text-ink-500 normal-case ml-2 tracking-normal">
                            {VOICE_INFO[v].vibe}
                          </span>
                        </button>
                      ))}
                      {turn.voiceOverride && (
                        <button
                          onClick={() => {
                            setTurnVoiceOverride(turn.id, undefined);
                            setShowVoicePicker(false);
                          }}
                          className="px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-red-400 hover:text-red-300 hover:bg-ink-800 transition-colors border-t border-ink-800 mt-0.5 pt-1"
                        >
                          Reset to default
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Regenerate button */}
              <button
                onClick={() => setShowRegenPopover(!showRegenPopover)}
                disabled={regenerating}
                className="px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-ink-400 hover:text-ink-50 border border-ink-800 hover:border-ink-50 transition-colors disabled:opacity-50"
                title="Regenerate this turn with AI"
              >
                {regenerating ? "↻ …" : "↻ Regen"}
              </button>

              {/* Regenerate popover */}
              {showRegenPopover && (
                <div className="absolute bottom-full right-0 mb-2 w-72 bg-ink-950 border border-ink-700 p-3 z-20 shadow-xl">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-2">
                    Regenerate turn #{index + 1}
                  </div>
                  <textarea
                    value={regenHint}
                    onChange={(e) => setRegenHint(e.target.value)}
                    placeholder="Optional hint: 'make it shorter', 'more humor', 'add a statistic'…"
                    className="w-full h-16 bg-ink-900/60 border border-ink-800 focus:border-ink-600 outline-none p-2 font-mono text-[11px] text-ink-200 placeholder:text-ink-600 resize-none mb-2"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleRegenerate}
                      disabled={regenerating}
                      className="flex-1 py-1.5 bg-ink-50 text-ink-950 font-mono text-[10px] uppercase tracking-widest font-bold hover:bg-white transition-colors disabled:opacity-50"
                    >
                      {regenerating ? "Regenerating…" : "Regenerate"}
                    </button>
                    <button
                      onClick={() => {
                        setShowRegenPopover(false);
                        setRegenHint("");
                      }}
                      className="px-3 py-1.5 border border-ink-800 text-ink-400 font-mono text-[10px] uppercase tracking-widest hover:text-ink-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={previewing ? handleStop : handlePreview}
                className="px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-ink-400 hover:text-ink-50 border border-ink-800 hover:border-ink-50 transition-colors"
              >
                {previewing ? "■ Stop" : "▶ Preview"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
