import { Router } from "express";
import { generateScript } from "../lib/xaiClient.js";
import { buildSystemPrompt, buildUserMessage } from "../prompts/builder.js";
import { lintScript } from "../lib/scriptLinter.js";
import { logger } from "../lib/logger.js";
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

    // P2.1/P2.2 — Lint the script for tag issues and banned phrases
    const lintWarnings = lintScript(script.turns);
    if (lintWarnings.length > 0) {
      logger.warn(
        {
          warningCount: lintWarnings.length,
          types: lintWarnings.map((w) => w.type),
        },
        "Script lint produced warnings"
      );
    }

    res.json({
      script,
      lintWarnings,
      debugPrompt: { system: systemPrompt, user: userMessage },
    });
  } catch (e) {
    const msg = (e as Error).message;
    logger.error({ err: msg, route: "/api/generate-script" }, "Script generation failed");
    res.status(502).json({ error: "Script generation failed", details: msg });
  }
});
