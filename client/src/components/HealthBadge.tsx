import { useEffect, useState } from "react";

interface Health {
  ok: boolean;
  hasApiKey: boolean;
  version: string;
}

const POLL_INTERVAL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 3_000;

export default function HealthBadge() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const ctrl = new AbortController();
      const timeoutId = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
      try {
        const r = await fetch("/api/health", { signal: ctrl.signal });
        const data = (await r.json()) as Health;
        if (cancelled) return;
        setHealth(data);
        setError(false);
      } catch {
        if (cancelled) return;
        setError(true);
        setHealth(null);
      } finally {
        clearTimeout(timeoutId);
        if (!cancelled) setChecking(false);
      }
    }

    poll();
    const intervalId = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  let dotColor = "bg-ink-500";
  let label = "checking…";
  if (error) {
    dotColor = "bg-red-500";
    label = "server offline";
  } else if (health) {
    if (health.ok && health.hasApiKey) {
      dotColor = "bg-emerald-400";
      label = `online · v${health.version}`;
    } else if (health.ok) {
      dotColor = "bg-amber-400";
      label = "no api key";
    }
  } else if (!checking) {
    // Lost state but not in error — fall back to neutral.
    dotColor = "bg-ink-500";
    label = "unknown";
  }

  return (
    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
      <span
        className={`w-1.5 h-1.5 rounded-full ${dotColor} ${
          dotColor === "bg-emerald-400" ? "animate-pulse-soft" : ""
        }`}
      />
      <span>{label}</span>
    </div>
  );
}
