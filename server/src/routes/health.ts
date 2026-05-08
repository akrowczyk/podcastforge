import { Router } from "express";
import { xaiPing } from "../lib/xaiClient.js";

export const healthRouter = Router();

const SERVICE_VERSION = "0.1.0";
const startedAt = Date.now();

healthRouter.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "podcastforge",
    version: SERVICE_VERSION,
    uptime_sec: Math.floor((Date.now() - startedAt) / 1000),
    hasApiKey: Boolean(process.env.XAI_API_KEY),
    modelDefault: process.env.XAI_SCRIPT_MODEL || "grok-4.3",
    node: process.version,
  });
});

// ===== Deep health: actually pings xAI. Cached for 60s. =====

interface DeepCacheEntry {
  payload: {
    ok: boolean;
    xaiReachable: boolean;
    latencyMs: number;
    modelsAvailable?: number;
    cachedAt: string;
    error?: string;
  };
  expiresAt: number;
}

const DEEP_TTL_MS = 60_000;
let deepCache: DeepCacheEntry | null = null;

healthRouter.get("/deep", async (_req, res) => {
  const now = Date.now();
  if (deepCache && deepCache.expiresAt > now) {
    const cacheAgeSec = Math.floor(
      (now - new Date(deepCache.payload.cachedAt).getTime()) / 1000
    );
    res.json({ ...deepCache.payload, cacheAgeSec });
    return;
  }

  const result = await xaiPing();
  const payload = {
    ok: result.ok,
    xaiReachable: result.ok,
    latencyMs: result.latencyMs,
    modelsAvailable: result.modelsAvailable,
    cachedAt: new Date(now).toISOString(),
    error: result.error,
  };
  deepCache = { payload, expiresAt: now + DEEP_TTL_MS };
  res.json({ ...payload, cacheAgeSec: 0 });
});
