import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "podcastforge",
    version: "0.1.0",
    hasApiKey: Boolean(process.env.XAI_API_KEY),
  });
});
