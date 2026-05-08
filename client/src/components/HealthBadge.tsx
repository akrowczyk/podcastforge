import { useEffect, useState } from "react";

interface Health {
  ok: boolean;
  hasApiKey: boolean;
  version: string;
}

export default function HealthBadge() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setError(true));
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
