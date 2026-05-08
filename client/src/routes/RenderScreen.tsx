import { useNavigate } from "react-router-dom";
import { useRef, useState } from "react";
import { useProject } from "../store/projectStore";
import { renderEpisode } from "../lib/audio/render";
import type { AudioQuality } from "@shared/types";

export default function RenderScreen() {
  const nav = useNavigate();
  const {
    script,
    config,
    patchConfig,
    turnRenders,
    setTurnRender,
    finalAudioUrl,
    finalRenderState,
    finalRenderError,
    setFinalAudio,
    setFinalRenderState,
  } = useProject();
  const [progressLine, setProgressLine] = useState<string>("");
  const cacheRef = useRef<Map<string, ArrayBuffer>>(new Map());
  const finalBlobRef = useRef<Blob | null>(null);

  if (!script) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-20 text-center animate-fade-up">
        <h2 className="font-display font-black text-display-md mb-4 tracking-tightest">
          Nothing to render
        </h2>
        <button
          onClick={() => nav("/")}
          className="bg-ink-50 text-ink-950 px-8 py-3 font-display font-bold uppercase tracking-tight"
        >
          ← Source
        </button>
      </div>
    );
  }

  const completedCount = Object.values(turnRenders).filter(
    (r) => r.state === "done"
  ).length;
  const failedCount = Object.values(turnRenders).filter(
    (r) => r.state === "failed"
  ).length;

  async function handleRender() {
    if (!script) return;
    setFinalRenderState("rendering");
    setProgressLine("Synthesizing turns…");
    try {
      const result = await renderEpisode({
        script,
        config,
        cache: cacheRef.current,
        callbacks: {
          onTurnStart: (id) => {
            setTurnRender(id, { state: "rendering" });
            setProgressLine(`Synthesizing turn ${id}…`);
          },
          onTurnDone: (id, url) => {
            setTurnRender(id, { state: "done", audioBlobUrl: url });
          },
          onTurnError: (id, err) => {
            setTurnRender(id, { state: "failed", error: err });
          },
        },
      });
      setProgressLine("Stitching and encoding MP3…");
      finalBlobRef.current = result.blob;
      setFinalAudio(result.url);
      setFinalRenderState("done");
      setProgressLine(
        `Done · ${Math.round(result.durationSec / 6) / 10} min · ${(
          result.blob.size /
          1024 /
          1024
        ).toFixed(2)} MB`
      );
    } catch (e) {
      setFinalRenderState("failed", (e as Error).message);
      setProgressLine("");
    }
  }

  async function handleDownload() {
    const blob = finalBlobRef.current;
    // Fallback: if ref is empty (e.g. after HMR), reconstruct from the blob URL
    const downloadBlob = blob || (finalAudioUrl ? await fetch(finalAudioUrl).then(r => r.blob()) : null);
    if (!downloadBlob || !script) return;

    const slug = (script.title || "PodcastForge_episode")
      .replace(/[^\w-]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const date = new Date().toISOString().slice(0, 10);
    const filename = `${slug}_${date}.mp3`;

    // Try modern File System Access API first (shows native Save dialog)
    if ("showSaveFilePicker" in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: "MP3 Audio",
              accept: { "audio/mpeg": [".mp3"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(downloadBlob);
        await writable.close();
        return;
      } catch (err: any) {
        // User cancelled the save dialog — just return silently
        if (err?.name === "AbortError") return;
        // Other error — fall through to legacy approach
      }
    }

    // Fallback: classic anchor-click download
    const url = URL.createObjectURL(new Blob([downloadBlob], { type: "audio/mpeg" }));
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

  function handleRetryFailed() {
    // For P0/P1 we just re-run the whole render; P3 will add per-turn retry
    handleRender();
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-10 w-full animate-fade-up">
      <div className="flex flex-col lg:flex-row justify-between gap-6 mb-10">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink-500 mb-2">
            / Phase 03 — Render & Export
          </div>
          <h1 className="font-display font-black text-display-lg tracking-tightest">
            {script.title}
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
        {/* Progress list */}
        <section>
          <div className="font-mono text-[11px] uppercase tracking-widest text-ink-500 mb-3">
            Turn Status — {completedCount}/{script.turns.length} ready
            {failedCount > 0 && (
              <span className="text-red-400 ml-2">
                · {failedCount} failed
              </span>
            )}
          </div>
          <div className="border border-ink-800 divide-y divide-ink-800">
            {script.turns.map((turn, i) => {
              const r = turnRenders[turn.id];
              const state = r?.state || "idle";
              return (
                <div
                  key={turn.id}
                  className="flex items-center gap-3 px-4 py-2.5 bg-ink-900/30"
                >
                  <span className="font-mono text-[10px] text-ink-600 w-8">
                    {String(i + 1).padStart(3, "0")}
                  </span>
                  <span
                    className={[
                      "w-6 h-6 flex items-center justify-center font-display font-bold text-[11px]",
                      turn.speaker === "A"
                        ? "bg-ink-50 text-ink-950"
                        : turn.speaker === "B"
                        ? "border border-ink-50 text-ink-50"
                        : "border border-ink-600 text-ink-400",
                    ].join(" ")}
                  >
                    {turn.speaker}
                  </span>
                  <span className="flex-1 truncate font-mono text-xs text-ink-400">
                    {turn.text.slice(0, 100)}
                    {turn.text.length > 100 ? "…" : ""}
                  </span>
                  <StateBadge state={state} error={r?.error} />
                </div>
              );
            })}
          </div>
        </section>

        {/* Controls */}
        <aside className="space-y-5 lg:sticky lg:top-24 self-start">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-ink-500 mb-2">
              Audio Quality
            </div>
            <div className="grid grid-cols-3 gap-px bg-ink-800">
              {(["standard", "high", "studio"] as AudioQuality[]).map((q) => {
                const active = config.audioQuality === q;
                return (
                  <button
                    key={q}
                    onClick={() => patchConfig({ audioQuality: q })}
                    className={[
                      "px-3 py-2.5 text-[10px] font-mono uppercase tracking-widest transition-colors",
                      active
                        ? "bg-ink-50 text-ink-950"
                        : "bg-ink-950 text-ink-400 hover:text-ink-100 hover:bg-ink-900",
                    ].join(" ")}
                  >
                    {q}
                  </button>
                );
              })}
            </div>
            <div className="font-mono text-[10px] text-ink-600 mt-1">
              {config.audioQuality === "standard" && "24kHz · 128kbps"}
              {config.audioQuality === "high" && "44.1kHz · 192kbps"}
              {config.audioQuality === "studio" && "48kHz · 256kbps"}
            </div>
          </div>

          <div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-ink-500 mb-2">
              Speaker-switch pause
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={100}
                max={600}
                step={50}
                value={config.pauseSpeakerSwitchMs}
                onChange={(e) =>
                  patchConfig({ pauseSpeakerSwitchMs: Number(e.target.value) })
                }
                className="flex-1 accent-ink-50"
              />
              <span className="font-mono text-xs text-ink-300 tabular-nums w-14 text-right">
                {config.pauseSpeakerSwitchMs}ms
              </span>
            </div>
          </div>

          <div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-ink-500 mb-2">
              Same-speaker pause
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={50}
                max={400}
                step={25}
                value={config.pauseSameSpeakerMs}
                onChange={(e) =>
                  patchConfig({ pauseSameSpeakerMs: Number(e.target.value) })
                }
                className="flex-1 accent-ink-50"
              />
              <span className="font-mono text-xs text-ink-300 tabular-nums w-14 text-right">
                {config.pauseSameSpeakerMs}ms
              </span>
            </div>
          </div>

          {finalRenderState === "rendering" && (
            <div className="border border-ink-800 bg-ink-900/40 p-3">
              <div className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-2">
                Rendering…
              </div>
              <div className="font-mono text-xs text-ink-300">
                {progressLine}
              </div>
              <div className="mt-3 h-px bg-ink-800 overflow-hidden relative">
                <div className="absolute inset-y-0 w-1/3 bg-ink-50 animate-scan" />
              </div>
            </div>
          )}

          {finalRenderState === "done" && finalAudioUrl && (
            <div className="border border-emerald-900 bg-emerald-950/30 p-4 space-y-3">
              <div className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">
                Render complete
              </div>
              <audio controls src={finalAudioUrl} className="w-full" />
              <div className="font-mono text-[10px] text-ink-500">
                {progressLine}
              </div>
            </div>
          )}

          {finalRenderState === "failed" && (
            <div className="border border-red-900 bg-red-950/30 p-3 space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-widest text-red-300">
                Render failed
              </div>
              <div className="font-mono text-xs text-red-200">
                {finalRenderError}
              </div>
              <button
                onClick={handleRetryFailed}
                className="text-[10px] font-mono uppercase tracking-widest text-ink-200 underline"
              >
                Retry
              </button>
            </div>
          )}

          <div className="space-y-2 pt-2 border-t border-ink-800">
            <button
              onClick={handleRender}
              disabled={finalRenderState === "rendering"}
              className="w-full bg-ink-50 text-ink-950 hover:bg-white disabled:bg-ink-800 disabled:text-ink-600 disabled:cursor-not-allowed py-4 font-display font-bold tracking-tight uppercase transition-colors"
            >
              {finalRenderState === "done" ? "Re-render" : "Render Episode"}
            </button>

            <button
              onClick={handleDownload}
              disabled={!finalAudioUrl}
              className="w-full border border-ink-50 text-ink-50 hover:bg-ink-50 hover:text-ink-950 disabled:border-ink-800 disabled:text-ink-700 disabled:cursor-not-allowed py-3 font-display font-bold tracking-tight uppercase transition-colors"
            >
              ↓ Download MP3
            </button>

            <button
              onClick={() => nav("/editor")}
              className="w-full text-ink-500 hover:text-ink-200 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors"
            >
              ← Back to editor
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StateBadge({
  state,
  error,
}: {
  state: "idle" | "rendering" | "done" | "failed";
  error?: string;
}) {
  if (state === "idle")
    return (
      <span className="font-mono text-[10px] uppercase tracking-widest text-ink-700">
        queued
      </span>
    );
  if (state === "rendering")
    return (
      <span className="font-mono text-[10px] uppercase tracking-widest text-ink-200 animate-pulse-soft">
        ● synth
      </span>
    );
  if (state === "done")
    return (
      <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">
        ● done
      </span>
    );
  return (
    <span
      className="font-mono text-[10px] uppercase tracking-widest text-red-400"
      title={error}
    >
      ● failed
    </span>
  );
}
