import { useNavigate, useSearchParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { useProject } from "../store/projectStore";
import VoicePicker from "../components/VoicePicker";
import TurnCard from "../components/TurnCard";
import { humanizeScriptApi } from "../lib/grokClient";
import type { DebugPromptPair, LintWarning, Speaker } from "@shared/types";

export default function EditorScreen() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    script,
    config,
    setVoice,
    lintWarnings,
    debugPrompts,
    setScript,
    setDebugPrompts,
    insertTurn,
    duplicateTurn,
    deleteTurn,
    moveTurn,
    swapAllSpeakers,
    exportProject,
  } = useProject();

  const showDebug = searchParams.get("debug") === "1";
  const [confirmSwap, setConfirmSwap] = useState(false);
  const [confirmHumanize, setConfirmHumanize] = useState(false);
  const [humanizing, setHumanizing] = useState(false);
  const [humanizeError, setHumanizeError] = useState<string | null>(null);

  const canHumanize =
    config.mode === "two-host" &&
    (config.tone === "casual" || config.tone === "energetic");

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
          className="bg-ink-50 text-ink-950 px-8 py-3 font-display font-bold uppercase tracking-tight hover:bg-ink-200 transition-colors"
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

  // Group lint warnings by turn
  const warningsByTurn = useMemo(() => {
    const map = new Map<string, LintWarning[]>();
    for (const w of lintWarnings) {
      const arr = map.get(w.turnId) || [];
      arr.push(w);
      map.set(w.turnId, arr);
    }
    return map;
  }, [lintWarnings]);

  function swapSpeaker(turnId: string) {
    if (!script) return;
    const turn = script.turns.find((t) => t.id === turnId);
    if (!turn) return;
    if (config.mode === "solo") return;
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

  async function handleExport() {
    const json = exportProject();
    const slug = (script?.title || "project")
      .replace(/[^\w-]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const filename = `${slug}.podcastforge.json`;
    const blob = new Blob([json], { type: "application/json" });

    if ("showSaveFilePicker" in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: "PodcastForge Project JSON",
              accept: { "application/json": [".json"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") return;
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 200);
  }

  function handleSwapAll() {
    swapAllSpeakers();
    setConfirmSwap(false);
  }

  async function handleHumanize() {
    if (!script) return;
    setConfirmHumanize(false);
    setHumanizing(true);
    setHumanizeError(null);
    try {
      const result = await humanizeScriptApi({ script, config });
      setScript(result.script);
      setDebugPrompts({
        pass1: debugPrompts?.pass1 || { system: "", user: "" },
        pass2: result.debugPrompt,
      });
    } catch (e) {
      setHumanizeError((e as Error).message);
    } finally {
      setHumanizing(false);
    }
  }

  // Figure out the default speaker for insert between turns
  function nextSpeaker(afterId: string | null): Speaker {
    if (config.mode === "solo") return "N";
    if (!afterId || !script) return "A";
    const idx = script.turns.findIndex((t) => t.id === afterId);
    if (idx === -1) return "A";
    return script.turns[idx].speaker === "A" ? "B" : "A";
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
          <StatBlock label="Turns" value={String(stats.turns)} />
          <StatBlock label="Chars" value={stats.chars.toLocaleString()} />
          <StatBlock label="Est. Length" value={`${stats.mins} min`} />
          <StatBlock label="TTS Cost" value={`$${stats.cost.toFixed(3)}`} />
        </div>
      </div>

      {/* Lint warning banner */}
      {lintWarnings.length > 0 && <LintBanner warnings={lintWarnings} />}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        {/* Turn list */}
        <div className="space-y-0">
          {/* Insert at top */}
          <InsertAffordance
            onClick={() => insertTurn(null, nextSpeaker(null))}
          />

          {script.turns.map((turn, i) => (
            <div key={turn.id}>
              <TurnCard
                turn={turn}
                index={i}
                allTurns={script.turns}
                lintWarnings={warningsByTurn.get(turn.id) || []}
                isFirst={i === 0}
                isLast={i === script.turns.length - 1}
                onSwapSpeaker={() => swapSpeaker(turn.id)}
                onMove={(dir) => moveTurn(turn.id, dir)}
                onDuplicate={() => duplicateTurn(turn.id)}
                onDelete={() => deleteTurn(turn.id)}
              />
              {/* Insert between turns */}
              <InsertAffordance
                onClick={() => insertTurn(turn.id, nextSpeaker(turn.id))}
              />
            </div>
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

          {/* Bulk speaker swap (two-host only) */}
          {config.mode === "two-host" && (
            <div className="pt-2">
              {confirmSwap ? (
                <div className="border border-ink-700 bg-ink-900/60 p-3 space-y-2">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-ink-400">
                    Swap all A↔B? This will invalidate all cached audio.
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSwapAll}
                      className="flex-1 py-1.5 bg-ink-50 text-ink-950 font-mono text-[10px] uppercase tracking-widest font-bold hover:bg-ink-200 transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmSwap(false)}
                      className="px-3 py-1.5 border border-ink-800 text-ink-400 font-mono text-[10px] uppercase tracking-widest hover:text-ink-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmSwap(true)}
                  className="w-full py-2 text-[10px] font-mono uppercase tracking-widest text-ink-500 border border-ink-800 hover:text-ink-200 hover:border-ink-600 transition-colors"
                >
                  Swap all A↔B
                </button>
              )}
            </div>
          )}

          {/* P8 — Re-humanize (casual/energetic two-host only) */}
          {canHumanize && (
            <div className="pt-2">
              {humanizing ? (
                <div className="w-full py-2 text-[10px] font-mono uppercase tracking-widest text-ink-400 border border-ink-700 text-center">
                  Humanizing… (~30s)
                </div>
              ) : confirmHumanize ? (
                <div className="border border-ink-700 bg-ink-900/60 p-3 space-y-2">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-ink-400">
                    Re-humanize? Every turn will be rewritten and all cached audio invalidated.
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleHumanize}
                      className="flex-1 py-1.5 bg-ink-50 text-ink-950 font-mono text-[10px] uppercase tracking-widest font-bold hover:bg-ink-200 transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmHumanize(false)}
                      className="px-3 py-1.5 border border-ink-800 text-ink-400 font-mono text-[10px] uppercase tracking-widest hover:text-ink-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmHumanize(true)}
                  className="w-full py-2 text-[10px] font-mono uppercase tracking-widest text-ink-500 border border-ink-800 hover:text-ink-200 hover:border-ink-600 transition-colors"
                >
                  ↻ Re-humanize script
                </button>
              )}
              {humanizeError && (
                <div className="mt-2 font-mono text-[10px] text-amber-400">
                  {humanizeError}
                </div>
              )}
            </div>
          )}

          <div className="pt-4 border-t border-ink-800 space-y-2">
            <button
              onClick={() => nav("/render")}
              className="w-full group bg-ink-50 text-ink-950 hover:bg-ink-200 py-4 font-display font-bold tracking-tight uppercase transition-colors"
            >
              <span className="flex items-center justify-center gap-3">
                Render Audio
                <span className="text-xl">→</span>
              </span>
            </button>

            <button
              onClick={handleExport}
              className="w-full py-2 text-[10px] font-mono uppercase tracking-widest text-ink-500 border border-ink-800 hover:text-ink-200 hover:border-ink-600 transition-colors"
            >
              ↓ Export Project (.json)
            </button>

            <button
              onClick={() => nav("/")}
              className="w-full text-ink-500 hover:text-ink-200 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors"
            >
              ← Back to Source
            </button>
          </div>

          {/* Debug prompt viewer — only shown with ?debug=1 */}
          {showDebug && debugPrompts && (
            <DebugPromptsPanel
              pass1={debugPrompts.pass1}
              pass2={debugPrompts.pass2}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

// ===== Sub-components =====

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-ink-500">{label}</span>
      <span className="text-ink-50 font-display font-bold tracking-tight text-xl normal-case tabular-nums">
        {value}
      </span>
    </div>
  );
}

function InsertAffordance({ onClick }: { onClick: () => void }) {
  return (
    <div className="group/insert relative h-2 flex items-center justify-center">
      <button
        onClick={onClick}
        className="absolute inset-x-0 flex items-center justify-center opacity-0 group-hover/insert:opacity-100 transition-opacity z-10"
      >
        <div className="flex items-center gap-2 px-3 py-0.5 bg-ink-800 hover:bg-ink-700 transition-colors">
          <span className="text-ink-400 text-[10px] font-mono uppercase tracking-widest">
            + Add turn
          </span>
        </div>
      </button>
      <div className="absolute inset-x-0 h-px bg-transparent group-hover/insert:bg-ink-700 transition-colors" />
    </div>
  );
}

function LintBanner({ warnings }: { warnings: LintWarning[] }) {
  const [expanded, setExpanded] = useState(false);
  const tagWarnings = warnings.filter(
    (w) => w.type === "tag-count" || w.type === "unclosed-tag" || w.type === "unknown-tag"
  );
  const phraseWarnings = warnings.filter((w) => w.type === "banned-phrase");

  return (
    <div className="mb-6 border border-amber-800/60 bg-amber-950/20 px-4 py-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <span className="text-amber-400 text-sm">⚠</span>
          <span className="font-mono text-[11px] uppercase tracking-widest text-amber-300">
            {warnings.length} lint warning{warnings.length !== 1 ? "s" : ""}
            {tagWarnings.length > 0 && ` · ${tagWarnings.length} tag`}
            {phraseWarnings.length > 0 && ` · ${phraseWarnings.length} phrase`}
          </span>
        </div>
        <span className="font-mono text-[10px] text-ink-500">
          {expanded ? "▲ collapse" : "▼ expand"}
        </span>
      </button>
      {expanded && (
        <div className="mt-3 space-y-1 border-t border-amber-900/40 pt-3">
          {warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-2 font-mono text-[11px] text-amber-200/80"
            >
              <span className="text-amber-500 shrink-0">{w.turnId}</span>
              <span className="text-ink-600">·</span>
              <span className="text-amber-400/60 shrink-0 uppercase text-[9px] tracking-wider w-20">
                {w.type}
              </span>
              <span>{w.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DebugPromptsPanel({
  pass1,
  pass2,
}: {
  pass1: DebugPromptPair;
  pass2?: DebugPromptPair;
}) {
  return (
    <div className="mt-4 pt-4 border-t border-ink-800 space-y-3">
      <div className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
        Debug prompts
      </div>
      <DebugPromptSection
        label={pass2 ? "Pass 1 — base script" : "Prompt"}
        system={pass1.system}
        user={pass1.user}
      />
      {pass2 && (
        <DebugPromptSection
          label="Pass 2 — humanize"
          system={pass2.system}
          user={pass2.user}
        />
      )}
    </div>
  );
}

function DebugPromptSection({
  label,
  system,
  user,
}: {
  label: string;
  system: string;
  user: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const full = `=== SYSTEM ===\n${system}\n\n=== USER ===\n${user}`;
    await navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <details>
      <summary className="font-mono text-[10px] uppercase tracking-widest text-ink-500 cursor-pointer hover:text-ink-300 transition-colors">
        ▸ {label}
      </summary>
      <div className="mt-3 space-y-3">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-ink-600 mb-1">
            System prompt
          </div>
          <pre className="text-[11px] font-mono text-ink-400 bg-ink-900/60 border border-ink-800 p-3 max-h-48 overflow-auto whitespace-pre-wrap leading-relaxed">
            {system}
          </pre>
        </div>
        <div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-ink-600 mb-1">
            User message
          </div>
          <pre className="text-[11px] font-mono text-ink-400 bg-ink-900/60 border border-ink-800 p-3 max-h-48 overflow-auto whitespace-pre-wrap leading-relaxed">
            {user}
          </pre>
        </div>
        <button
          onClick={handleCopy}
          className="w-full py-2 text-[10px] font-mono uppercase tracking-widest border border-ink-800 text-ink-400 hover:text-ink-50 hover:border-ink-50 transition-colors"
        >
          {copied ? "✓ Copied" : "Copy prompt"}
        </button>
      </div>
    </details>
  );
}
