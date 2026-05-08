import express from "express";
import cors from "cors";
import "dotenv/config";
import pinoHttp from "pino-http";
import { healthRouter } from "./routes/health.js";
import { scriptRouter } from "./routes/generateScript.js";
import { ttsRouter } from "./routes/tts.js";
import { regenerateRouter } from "./routes/regenerateTurn.js";
import { tokenBucketLimiter } from "./lib/rateLimit.js";
import { logger } from "./lib/logger.js";

import { fetchRouter } from "./routes/fetchUrl.js";

const app = express();
const PORT = Number(process.env.PORT) || 8787;

app.use(
  pinoHttp({
    logger,
    // Polling /api/health from the HealthBadge every 30s would spam logs.
    autoLogging: {
      ignore: (req) => req.url === "/api/health",
    },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        ip: req.remoteAddress,
      }),
      res: (res) => ({ status: res.statusCode }),
    },
  })
);
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Per-IP rate limit on expensive endpoints. 60 calls/min, burst of 60.
const limiter = tokenBucketLimiter({ capacity: 60, refillPerSecond: 1 });

app.use("/api/health", healthRouter);
app.use("/api/generate-script", limiter, scriptRouter);
app.use("/api/tts", limiter, ttsRouter);
app.use("/api/regenerate-turn", limiter, regenerateRouter);
app.use("/api/fetch-url", limiter, fetchRouter);

app.listen(PORT, () => {
  logger.info({ port: PORT }, `PodcastForge server listening on http://localhost:${PORT}`);
  if (!process.env.XAI_API_KEY) {
    logger.warn("XAI_API_KEY is not set. Endpoints will fail until you set it.");
  }
});
