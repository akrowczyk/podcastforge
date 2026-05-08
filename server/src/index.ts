import express from "express";
import cors from "cors";
import "dotenv/config";
import { healthRouter } from "./routes/health.js";
import { scriptRouter } from "./routes/generateScript.js";
import { ttsRouter } from "./routes/tts.js";
import { tokenBucketLimiter } from "./lib/rateLimit.js";

const app = express();
const PORT = Number(process.env.PORT) || 8787;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Per-IP rate limit on expensive endpoints. 60 calls/min, burst of 60.
const limiter = tokenBucketLimiter({ capacity: 60, refillPerSecond: 1 });

app.use("/api/health", healthRouter);
app.use("/api/generate-script", limiter, scriptRouter);
app.use("/api/tts", limiter, ttsRouter);

app.listen(PORT, () => {
  console.log(`PodcastForge server listening on http://localhost:${PORT}`);
  if (!process.env.XAI_API_KEY) {
    console.warn("⚠  XAI_API_KEY is not set. Endpoints will fail until you set it.");
  }
});
