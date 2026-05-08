import { Router } from "express";
import { generateScript } from "../lib/xaiClient.js";
import { buildRegeneratePrompt } from "../prompts/regenerate.js";
import { logger } from "../lib/logger.js";
import type { RegenerateTurnRequest, Speaker } from "../../../shared/types.js";

export const regenerateRouter = Router();

regenerateRouter.post("/", async (req, res) => {
  try {
    const body = req.body as RegenerateTurnRequest;
    if (!body?.turn || !body?.config) {
      res.status(400).json({ error: "Missing turn or config" });
      return;
    }

    const { system, user } = buildRegeneratePrompt({
      turn: body.turn,
      precedingTurns: body.precedingTurns || [],
      followingTurns: body.followingTurns || [],
      hint: body.hint,
      config: body.config,
    });

    // Reuse the chat completions call with JSON mode
    const result = await generateScript({
      systemPrompt: system,
      userMessage: user,
    });

    // The model returns a full Script shape, but we only need the first "turn"
    // from the parsed response. However, since we asked for { speaker, text },
    // generateScript might wrap it. Let's handle both shapes.
    let turnData: { speaker: Speaker; text: string };

    if (result.turns && result.turns.length > 0) {
      turnData = {
        speaker: result.turns[0].speaker,
        text: result.turns[0].text,
      };
    } else {
      // Fallback: the raw parsed object might be { speaker, text } directly
      const raw = result as unknown as Record<string, unknown>;
      turnData = {
        speaker: (raw.speaker as Speaker) || body.turn.speaker,
        text: String(raw.text || body.turn.text),
      };
    }

    res.json({
      turn: {
        id: body.turn.id,
        speaker: turnData.speaker,
        text: turnData.text.trim(),
      },
    });
  } catch (e) {
    const msg = (e as Error).message;
    logger.error({ err: msg, route: "/api/regenerate-turn" }, "Turn regeneration failed");
    res.status(502).json({ error: "Turn regeneration failed", details: msg });
  }
});
