import type { Request, Response, NextFunction } from "express";

interface Bucket {
  tokens: number;
  lastRefill: number;
}

interface LimiterOptions {
  capacity: number;       // max tokens
  refillPerSecond: number; // tokens per second
}

export function tokenBucketLimiter(opts: LimiterOptions) {
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || "unknown";
    const now = Date.now();
    const bucket = buckets.get(key) || {
      tokens: opts.capacity,
      lastRefill: now,
    };
    const elapsedSec = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(
      opts.capacity,
      bucket.tokens + elapsedSec * opts.refillPerSecond
    );
    bucket.lastRefill = now;
    if (bucket.tokens < 1) {
      buckets.set(key, bucket);
      res.status(429).json({ error: "Rate limit exceeded" });
      return;
    }
    bucket.tokens -= 1;
    buckets.set(key, bucket);
    next();
  };
}
