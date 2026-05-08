import { Router } from "express";
import { runHumanizePass } from "../lib/humanizePass.js";
import { logger } from "../lib/logger.js";
import type { HumanizeScriptRequest } from "../../../shared/types.js";

export const humanizeRouter = Router();

humanizeRouter.post("/", async (req, res) => {
  try {
    const body = req.body as HumanizeScriptRequest;
    if (!body?.script?.turns?.length || !body?.config) {
      res
        .status(400)
        .json({ error: "Missing script.turns or config" });
      return;
    }
    if (body.config.mode !== "two-host") {
      res.status(400).json({
        error: "Humanize is only supported for two-host scripts",
      });
      return;
    }

    const result = await runHumanizePass(body.script, body.config);
    res.json({
      script: result.script,
      debugPrompt: result.debugPrompt,
    });
  } catch (e) {
    const msg = (e as Error).message;
    logger.error(
      { err: msg, route: "/api/humanize-script" },
      "Script humanization failed"
    );
    res
      .status(502)
      .json({ error: "Script humanization failed", details: msg });
  }
});
