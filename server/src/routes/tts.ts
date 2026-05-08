import { Router } from "express";
import { synthesize } from "../lib/xaiClient.js";
import { logger } from "../lib/logger.js";
import type { TtsRequest } from "../../../shared/types.js";

export const ttsRouter = Router();

ttsRouter.post("/", async (req, res) => {
  try {
    const body = req.body as TtsRequest;
    if (!body?.text || !body?.voiceId || !body?.audioQuality) {
      res
        .status(400)
        .json({ error: "Missing required fields: text, voiceId, audioQuality" });
      return;
    }
    if (body.text.length === 0) {
      res.status(400).json({ error: "text is empty" });
      return;
    }
    if (body.text.length > 15_000) {
      res
        .status(400)
        .json({ error: "text exceeds 15,000 char Grok TTS limit" });
      return;
    }

    const { buffer, contentType } = await synthesize({
      text: body.text,
      voiceId: body.voiceId,
      language: body.language,
      audioQuality: body.audioQuality,
    });

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", String(buffer.byteLength));
    res.setHeader("Cache-Control", "no-store");
    res.send(Buffer.from(buffer));
  } catch (e) {
    const msg = (e as Error).message;
    logger.error({ err: msg, route: "/api/tts" }, "TTS failed");
    res.status(502).json({ error: "TTS failed", details: msg });
  }
});
