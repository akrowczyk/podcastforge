import type { VoiceId } from "@shared/types";
import { VOICE_INFO } from "@shared/types";

const VOICES: VoiceId[] = ["eve", "ara", "rex", "sal", "leo"];

export default function VoicePicker({
  label,
  value,
  onChange,
  accentChar,
}: {
  label: string;
  value: VoiceId;
  onChange: (v: VoiceId) => void;
  accentChar?: string;
}) {
  const info = VOICE_INFO[value as keyof typeof VOICE_INFO];
  return (
    <div className="border border-ink-800 bg-ink-900/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {accentChar && (
            <div className="w-8 h-8 border border-ink-50 flex items-center justify-center font-display font-bold text-sm">
              {accentChar}
            </div>
          )}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
              {label}
            </div>
            <div className="font-display font-semibold text-lg tracking-tight">
              {info?.label || value}
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-px bg-ink-800">
        {VOICES.map((v) => {
          const active = v === value;
          return (
            <button
              key={v}
              onClick={() => onChange(v)}
              className={[
                "py-2 text-[10px] font-mono uppercase tracking-widest transition-colors",
                active
                  ? "bg-ink-50 text-ink-950"
                  : "bg-ink-900/40 text-ink-400 hover:text-ink-100 hover:bg-ink-800/30",
              ].join(" ")}
            >
              {v}
            </button>
          );
        })}
      </div>
      {info && (
        <div className="text-[11px] text-ink-500 mt-2 italic">{info.vibe}</div>
      )}
    </div>
  );
}
