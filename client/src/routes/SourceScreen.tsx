import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useProject } from "../store/projectStore";
import { generateScriptApi } from "../lib/grokClient";
import type {
  Audience,
  Length,
  Mode,
  Tone,
} from "@shared/types";

export default function SourceScreen() {
  const nav = useNavigate();
  const {
    sourceTitle,
    sourceText,
    config,
    setSourceTitle,
    setSourceText,
    patchConfig,
    setScript,
    setLintWarnings,
    setDebugPrompt,
  } = useProject();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const charCount = sourceText.length;
  const canGenerate = sourceText.trim().length > 200 && !generating;

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const result = await generateScriptApi({
        config,
        source: { title: sourceTitle, rawText: sourceText },
      });
      setScript(result.script);
      setLintWarnings(result.lintWarnings);
      setDebugPrompt(result.debugPrompt || null);
      nav("/editor");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-10 lg:py-16 w-full animate-fade-up">
      <Hero />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 lg:gap-12 mt-12">
        {/* Left: source content */}
        <section>
          <SectionLabel index="01" label="Source Material" />
          <input
            value={sourceTitle}
            onChange={(e) => setSourceTitle(e.target.value)}
            placeholder="Episode title (optional)"
            className="w-full bg-transparent border-0 border-b border-ink-700 focus:border-ink-50 outline-none py-3 text-2xl lg:text-3xl font-display font-semibold tracking-tighter placeholder:text-ink-700 transition-colors"
          />
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Paste your source material here. Article, report, transcript, anything Grok can read. Aim for 1,000–50,000 characters for best results."
            className="mt-6 w-full min-h-[460px] bg-ink-900/60 border border-ink-800 focus:border-ink-600 outline-none p-5 font-mono text-sm leading-relaxed text-ink-200 placeholder:text-ink-600 resize-vertical transition-colors"
          />
          <div className="flex items-center justify-between mt-3 font-mono text-[11px] uppercase tracking-widest text-ink-500">
            <span>{charCount.toLocaleString()} chars</span>
            <span>
              {charCount < 200
                ? "Need at least 200 chars"
                : charCount > 100_000
                ? "Very long — consider trimming"
                : "Ready"}
            </span>
          </div>
        </section>

        {/* Right: config */}
        <aside className="space-y-8">
          <div>
            <SectionLabel index="02" label="Configuration" />

            <ConfigGroup label="Mode">
              <ToggleGrid
                value={config.mode}
                options={[
                  { value: "two-host", label: "Two-Host" },
                  { value: "solo", label: "Solo Narrator" },
                ]}
                onChange={(v) => patchConfig({ mode: v as Mode })}
              />
            </ConfigGroup>

            <ConfigGroup label="Length">
              <ToggleGrid
                value={config.length}
                options={[
                  { value: "short", label: "5 min" },
                  { value: "medium", label: "10 min" },
                  { value: "long", label: "18 min" },
                ]}
                onChange={(v) => patchConfig({ length: v as Length })}
              />
            </ConfigGroup>

            <ConfigGroup label="Tone">
              <ToggleGrid
                value={config.tone}
                options={[
                  { value: "casual", label: "Casual" },
                  { value: "professional", label: "Professional" },
                  { value: "energetic", label: "Energetic" },
                  { value: "documentary", label: "Documentary" },
                ]}
                onChange={(v) => patchConfig({ tone: v as Tone })}
              />
            </ConfigGroup>

            <ConfigGroup label="Audience">
              <ToggleGrid
                value={config.audience}
                options={[
                  { value: "general", label: "General" },
                  { value: "technical", label: "Technical" },
                  { value: "executive", label: "Executive" },
                ]}
                onChange={(v) => patchConfig({ audience: v as Audience })}
              />
            </ConfigGroup>

            <ConfigGroup label="Focus prompt (optional)">
              <textarea
                value={config.focusPrompt || ""}
                onChange={(e) =>
                  patchConfig({ focusPrompt: e.target.value })
                }
                placeholder="e.g. Spend extra time on the agentic AI section."
                className="w-full bg-ink-900/60 border border-ink-800 focus:border-ink-600 outline-none p-3 font-mono text-xs text-ink-200 placeholder:text-ink-600 transition-colors h-20 resize-none"
              />
            </ConfigGroup>
          </div>

          {error && (
            <div className="border border-red-900 bg-red-950/40 p-3 font-mono text-xs text-red-300">
              {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full group relative overflow-hidden bg-ink-50 text-ink-950 hover:bg-white disabled:bg-ink-800 disabled:text-ink-600 disabled:cursor-not-allowed py-4 font-display font-bold tracking-tight uppercase text-base transition-all"
          >
            {generating ? (
              <span className="flex items-center justify-center gap-3">
                <Spinner />
                Generating script…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-3">
                Generate Script
                <span className="text-xl">→</span>
              </span>
            )}
            {generating && (
              <span className="absolute bottom-0 left-0 right-0 h-px bg-ink-950">
                <span className="block h-full bg-signal animate-scan w-1/2" />
              </span>
            )}
          </button>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-600 text-center">
            grok-4.3 · ~$0.05 per generation
          </div>
        </aside>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <div className="space-y-3">
      <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink-500">
        / Phase 01 — Source intake
      </div>
      <h1 className="font-display font-black tracking-tightest text-display-xl text-ink-50">
        Build a podcast.
        <br />
        <span className="text-ink-500">Two voices. One file.</span>
      </h1>
      <p className="text-ink-400 max-w-2xl text-base lg:text-lg leading-relaxed pt-2">
        Paste source material. PodcastForge generates a natural two-host
        conversation, lets you edit every line, then renders studio-quality
        audio through xAI's Grok voice stack.
      </p>
    </div>
  );
}

function SectionLabel({ index, label }: { index: string; label: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-5 pb-2 border-b border-ink-800">
      <span className="font-mono text-[11px] tracking-widest text-ink-500">
        {index}
      </span>
      <span className="font-display text-base font-semibold tracking-tight uppercase">
        {label}
      </span>
    </div>
  );
}

function ConfigGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-2">
        {label}
      </div>
      {children}
    </div>
  );
}

function ToggleGrid<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-px bg-ink-800">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={[
              "px-3 py-2.5 text-xs font-mono uppercase tracking-wider transition-colors",
              active
                ? "bg-ink-50 text-ink-950"
                : "bg-ink-950 text-ink-400 hover:text-ink-100 hover:bg-ink-900",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="w-4 h-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.2"
      />
      <path
        d="M21 12a9 9 0 0 1-9 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
