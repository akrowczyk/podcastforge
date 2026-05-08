import { useNavigate } from "react-router-dom";
import { useRef, useState } from "react";
import { useProject } from "../store/projectStore";
import { generateScriptApi } from "../lib/grokClient";
import type {
  Audience,
  Length,
  Mode,
  Tone,
} from "@shared/types";
import { extractPdfText } from "../lib/extractPdf";
import { extractDocxText } from "../lib/extractDocx";

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
    importProject,
  } = useProject();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"paste" | "upload" | "url">("paste");
  const [urlInput, setUrlInput] = useState("");
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

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

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const result = importProject(text);
      if (!result.ok) {
        setError(`Import failed: ${result.error}`);
      } else {
        setError(null);
        // If a script exists, go straight to editor
        const s = useProject.getState();
        if (s.script) {
          nav("/editor");
        }
      }
    } catch (err) {
      setError(`Import failed: ${(err as Error).message}`);
    }
    // Reset the file input so the same file can be re-imported
    if (importRef.current) importRef.current.value = "";
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    setUploadProgress(null);
    setError(null);
    try {
      let text = "";
      if (file.name.endsWith(".pdf")) {
        text = await extractPdfText(file, setUploadProgress);
      } else if (file.name.endsWith(".docx")) {
        text = await extractDocxText(file);
      } else if (file.name.endsWith(".txt") || file.name.endsWith(".md")) {
        text = await file.text();
      } else {
        throw new Error("Unsupported file type.");
      }
      setSourceText(text);
      if (!sourceTitle) {
        setSourceTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    } catch (err) {
      setError(`Extraction failed: ${(err as Error).message}`);
    } finally {
      setUploadingFile(false);
      setUploadProgress(null);
    }
    if (uploadRef.current) uploadRef.current.value = "";
  }

  async function handleUrlFetch() {
    if (!urlInput) return;
    setFetchingUrl(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:8787/api/fetch-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setSourceText(data.text);
      if (data.title && !sourceTitle) {
        setSourceTitle(data.title);
      }
    } catch (err) {
      setError(`Fetch failed: ${(err as Error).message}`);
    } finally {
      setFetchingUrl(false);
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-10 lg:py-16 w-full animate-fade-up">
      <Hero />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 lg:gap-12 mt-12">
        {/* Left: source content */}
        <section>
          <SectionLabel index="01" label="Source Material" />
          
          <div className="flex items-center gap-1 mb-4 border-b border-ink-800">
            {(["paste", "upload", "url"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={[
                  "px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors border-b-2",
                  tab === t
                    ? "border-ink-50 text-ink-50"
                    : "border-transparent text-ink-500 hover:text-ink-200"
                ].join(" ")}
              >
                {t === "paste" ? "Paste Text" : t === "upload" ? "Upload File" : "URL"}
              </button>
            ))}
          </div>

          <input
            value={sourceTitle}
            onChange={(e) => setSourceTitle(e.target.value)}
            placeholder="Episode title (optional)"
            className="w-full bg-transparent border-0 border-b border-ink-800 focus:border-ink-50 outline-none py-3 text-2xl lg:text-3xl font-display font-semibold tracking-tighter placeholder:text-ink-700 transition-colors"
          />

          {tab === "paste" && (
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="Paste your source material here. Article, report, transcript, anything Grok can read. Aim for 1,000–50,000 characters for best results."
              className="mt-6 w-full min-h-[460px] bg-ink-900/60 border border-ink-800 focus:border-ink-600 outline-none p-5 font-mono text-sm leading-relaxed text-ink-200 placeholder:text-ink-600 resize-vertical transition-colors"
            />
          )}

          {tab === "upload" && (
            <div className="mt-6 w-full min-h-[460px] bg-ink-900/60 border border-ink-800 p-5 flex flex-col items-center justify-center text-center">
              {uploadingFile ? (
                <div className="space-y-4">
                  <Spinner />
                  <div className="font-mono text-xs text-ink-400">
                    Extracting text… {uploadProgress !== null && `${uploadProgress}%`}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="font-mono text-xs text-ink-400 max-w-sm mx-auto">
                    Upload a file to extract its text. Supported formats: .pdf, .docx, .txt, .md
                  </div>
                  <input
                    ref={uploadRef}
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => uploadRef.current?.click()}
                    className="bg-ink-50 text-ink-950 px-6 py-3 font-display font-bold uppercase tracking-tight"
                  >
                    Select File
                  </button>
                </div>
              )}
              {sourceText && !uploadingFile && (
                <div className="mt-8 text-left w-full max-h-[300px] overflow-y-auto font-mono text-xs text-ink-500 border-t border-ink-800 pt-4">
                  <div className="text-ink-300 mb-2 font-bold">Extracted Preview:</div>
                  {sourceText.slice(0, 1000)}...
                </div>
              )}
            </div>
          )}

          {tab === "url" && (
            <div className="mt-6 w-full min-h-[460px] bg-ink-900/60 border border-ink-800 p-5 flex flex-col items-center justify-center text-center">
              {fetchingUrl ? (
                <div className="space-y-4">
                  <Spinner />
                  <div className="font-mono text-xs text-ink-400">Fetching and parsing URL…</div>
                </div>
              ) : (
                <div className="w-full max-w-lg space-y-4">
                  <div className="font-mono text-xs text-ink-400">
                    Paste a URL to extract its main article content.
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://..."
                      className="flex-1 bg-transparent border border-ink-700 focus:border-ink-50 outline-none px-4 py-3 font-mono text-sm text-ink-200 placeholder:text-ink-700 transition-colors"
                      onKeyDown={(e) => e.key === "Enter" && handleUrlFetch()}
                    />
                    <button
                      onClick={handleUrlFetch}
                      disabled={!urlInput}
                      className="bg-ink-50 text-ink-950 px-6 py-3 font-display font-bold uppercase tracking-tight disabled:bg-ink-800 disabled:text-ink-600"
                    >
                      Fetch
                    </button>
                  </div>
                </div>
              )}
              {sourceText && !fetchingUrl && (
                <div className="mt-8 text-left w-full max-h-[250px] overflow-y-auto font-mono text-xs text-ink-500 border-t border-ink-800 pt-4">
                  <div className="text-ink-300 mb-2 font-bold">Extracted Preview:</div>
                  {sourceText.slice(0, 1000)}...
                </div>
              )}
            </div>
          )}

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

          <div className="pt-3 border-t border-ink-800">
            <input
              ref={importRef}
              type="file"
              accept=".json,.podcastforge.json"
              onChange={handleImport}
              className="hidden"
            />
            <button
              onClick={() => importRef.current?.click()}
              className="w-full py-2 text-[10px] font-mono uppercase tracking-widest text-ink-500 border border-ink-800 hover:text-ink-200 hover:border-ink-600 transition-colors"
            >
              ↑ Import Project (.json)
            </button>
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
    <div className="grid grid-cols-2 gap-px bg-ink-800 border border-ink-800">
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
                : "bg-ink-900/40 text-ink-400 hover:text-ink-100 hover:bg-ink-800/60",
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
