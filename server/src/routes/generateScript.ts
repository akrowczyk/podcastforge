import { Router } from "express";
import { generateScript } from "../lib/xaiClient.js";
import { buildSystemPrompt, buildUserMessage } from "../prompts/builder.js";
import type { GenerateScriptRequest } from "../../../shared/types.js";

export const scriptRouter = Router();

scriptRouter.post("/", async (req, res) => {
  try {
    const body = req.body as GenerateScriptRequest;
    if (!body?.config || !body?.source?.rawText) {
      res.status(400).json({ error: "Missing config or source.rawText" });
      return;
    }
    if (body.source.rawText.length > 200_000) {
      res.status(413).json({ error: "Source text too long (max 200K chars)" });
      return;
    }

    const systemPrompt = buildSystemPrompt(body.config);
    const userMessage = buildUserMessage({
      title: body.source.title,
      focusPrompt: body.config.focusPrompt,
      sourceText: body.source.rawText,
    });

    const script = await generateScript({ systemPrompt, userMessage });

    // Coerce speaker types per mode
    if (body.config.mode === "solo") {
      script.turns = script.turns.map((t) => ({ ...t, speaker: "N" }));
    } else {
      script.turns = script.turns.map((t) => ({
        ...t,
        speaker: t.speaker === "N" ? "A" : t.speaker,
      }));
    }

    res.json({ script });
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[generate-script]", msg);
    res.status(502).json({ error: "Script generation failed", details: msg });
  }
});
