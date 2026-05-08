import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { useProject } from "../store/projectStore";
import VoicePicker from "../components/VoicePicker";
import TurnCard from "../components/TurnCard";

export default function EditorScreen() {
  const nav = useNavigate();
  const { script, config, setVoice } = useProject();

  if (!script) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-20 w-full text-center animate-fade-up">
        <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink-500 mb-3">
          / No script yet
        </div>
        <h2 className="font-display font-black text-display-md text-ink-50 mb-4 tracking-tightest">
          Generate a script first
        </h2>
        <p className="text-ink-400 mb-8">
          Head back to Source, paste some material, and click Generate.
        </p>
        <button
          onClick={() => nav("/")}
          className="bg-ink-50 text-ink-950 px-8 py-3 font-display font-bold uppercase tracking-tight hover:bg-white transition-colors"
        >
          ← Back to Source
        </button>
      </div>
    );
  }

  const stats = useMemo(() => {
    const totalChars = script.turns.reduce((s, t) => s + t.text.length, 0);
    const cost = (totalChars / 1_000_000) * 4.2;
    return {
      turns: script.turns.length,
      chars: totalChars,
      mins: Math.round(script.estimatedDurationSeconds / 6) / 10,
      cost,
    };
  }, [script]);

  function swapSpeaker(turnId: string) {
    if (!script) return;
    const turn = script.turns.find((t) => t.id === turnId);
    if (!turn) return;
    if (config.mode === "solo") return; // can't swap in solo
    const next = turn.speaker === "A" ? "B" : "A";
    useProject.setState((s) => ({
      script: s.script
        ? {
            ...s.script,
            turns: s.script.turns.map((t) =>
              t.id === turnId ? { ...t, speaker: next } : t
            ),
          }
        : s.script,
    }));
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-10 w-full animate-fade-up">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink-500 mb-2">
            / Phase 02 — Script editor
          </div>
          <h1 className="font-display font-black text-display-lg text-ink-50 tracking-tightest">
            {script.title}
          </h1>
        </div>
        <div className="flex flex-wrap gap-6 font-mono text-[11px] uppercase tracking-widest">
          <Stat label="Turns" value={String(stats.turns)} />
          <Stat label="Chars" value={stats.chars.toLocaleString()} />
          <Stat label="Est. Length" value={`${stats.mins} min`} />
          <Stat label="TTS Cost" value={`$${stats.cost.toFixed(3)}`} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        {/* Turn list */}
        <div className="space-y-2">
          {script.turns.map((turn, i) => (
            <TurnCard
              key={turn.id}
              turn={turn}
              index={i}
              onSwapSpeaker={() => swapSpeaker(turn.id)}
            />
          ))}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-24 self-start">
          <div className="font-mono text-[11px] uppercase tracking-widest text-ink-500 mb-2">
            Voice Casting
          </div>
          {config.mode === "two-host" ? (
            <>
              <VoicePicker
                label="Host A"
                accentChar="A"
                value={config.voices.A}
                onChange={(v) => setVoice("A", v)}
              />
              <VoicePicker
                label="Host B"
                accentChar="B"
                value={config.voices.B || "ara"}
                onChange={(v) => setVoice("B", v)}
              />
            </>
          ) : (
            <VoicePicker
              label="Narrator"
              accentChar="N"
              value={config.voices.N || "leo"}
              onChange={(v) => setVoice("N", v)}
            />
          )}

          <div className="pt-4 border-t border-ink-800 space-y-2">
            <button
              onClick={() => nav("/render")}
              className="w-full group bg-ink-50 text-ink-950 hover:bg-white py-4 font-display font-bold tracking-tight uppercase transition-colors"
            >
              <span className="flex items-center justify-center gap-3">
                Render Audio
                <span className="text-xl">→</span>
              </span>
            </button>
            <button
              onClick={() => nav("/")}
              className="w-full text-ink-500 hover:text-ink-200 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors"
            >
              ← Back to Source
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-ink-500">{label}</span>
      <span className="text-ink-50 font-display font-bold tracking-tight text-xl normal-case tabular-nums">
        {value}
      </span>
    </div>
  );
}
