import { Router } from "express";
import { generateScript } from "../lib/xaiClient.js";
import { buildSystemPrompt, buildUserMessage } from "../prompts/builder.js";
import { lintScript } from "../lib/scriptLinter.js";
import { runHumanizePass, shouldHumanize } from "../lib/humanizePass.js";
import { logger } from "../lib/logger.js";
import type {
  DebugPrompts,
  GenerateScriptRequest,
} from "../../../shared/types.js";

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

    const baseScript = await generateScript({ systemPrompt, userMessage });

    // Coerce speaker types per mode
    if (body.config.mode === "solo") {
      baseScript.turns = baseScript.turns.map((t) => ({ ...t, speaker: "N" }));
    } else {
      baseScript.turns = baseScript.turns.map((t) => ({
        ...t,
        speaker: t.speaker === "N" ? "A" : t.speaker,
      }));
    }

    // P8 — optional humanize pass for casual/energetic two-host
    let script = baseScript;
    const debugPrompts: DebugPrompts = {
      pass1: { system: systemPrompt, user: userMessage },
    };
    if (shouldHumanize(body.config)) {
      try {
        const humanized = await runHumanizePass(baseScript, body.config);
        script = humanized.script;
        debugPrompts.pass2 = humanized.debugPrompt;
      } catch (e) {
        // Pass 2 is best-effort — fall back to base script if it fails so
        // the user still gets something usable.
        logger.warn(
          { err: (e as Error).message },
          "Humanize pass 2 failed; returning base script"
        );
      }
    }

    // P2.1/P2.2/P8 — Lint the script (tone-aware) for tag issues and
    // banned phrases.
    const lintWarnings = lintScript(script.turns, body.config.tone);
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
      debugPrompts,
    });
  } catch (e) {
    const msg = (e as Error).message;
    logger.error({ err: msg, route: "/api/generate-script" }, "Script generation failed");
    res.status(502).json({ error: "Script generation failed", details: msg });
  }
});
