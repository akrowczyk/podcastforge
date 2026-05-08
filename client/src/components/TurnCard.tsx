import { useRef, useState } from "react";
import type { Turn } from "@shared/types";
import { useProject } from "../store/projectStore";
import { synthesizeTurn } from "../lib/audio/render";

const TAGS_INLINE = ["[pause]", "[laugh]", "[chuckle]", "[sigh]", "[breath]"];
const TAGS_WRAP = [
  { open: "<emphasis>", close: "</emphasis>", label: "<emphasis>" },
  { open: "<whisper>", close: "</whisper>", label: "<whisper>" },
  { open: "<slow>", close: "</slow>", label: "<slow>" },
  { open: "<soft>", close: "</soft>", label: "<soft>" },
];

interface Props {
  turn: Turn;
  index: number;
  onSwapSpeaker: () => void;
}

export default function TurnCard({ turn, index, onSwapSpeaker }: Props) {
  const { config, updateTurnText, turnRenders, setTurnRender } = useProject();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [previewing, setPreviewing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  async function handlePreview() {
    if (previewing) return;
    setPreviewing(true);
    try {
      // Reuse cached if present
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

  const charCount = turn.text.length;
  const tagCount = (turn.text.match(/\[[a-z-]+\]|<[a-z-]+>/gi) || []).length;
  const tagWarn = tagCount > 3;

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
        </button>

        {/* Text + toolbar column */}
        <div className="flex-1 p-4">
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
          </div>

          <textarea
            ref={textareaRef}
            value={turn.text}
            onChange={(e) => updateTurnText(turn.id, e.target.value)}
            rows={Math.max(2, Math.ceil(turn.text.length / 90))}
            className="w-full bg-transparent border-0 outline-none font-sans text-[15px] leading-relaxed text-ink-100 resize-none placeholder:text-ink-700"
          />

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-ink-800">
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-ink-500">
              <span>{charCount} chars</span>
              <span className={tagWarn ? "text-amber-400" : ""}>
                {tagCount} tags{tagWarn ? " ⚠" : ""}
              </span>
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
            <div className="flex items-center gap-1">
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
