import { Router } from "express";
import type { Request, Response } from "express";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import z from "zod";
import { logger } from "../lib/logger.js";

export const fetchRouter = Router();

const FetchUrlSchema = z.object({
  url: z.string().url(),
});

fetchRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { url } = FetchUrlSchema.parse(req.body);

    // SSRF Guard
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol)) {
      throw new Error("Bad protocol");
    }
    const host = u.hostname.toLowerCase();
    const blocked = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];
    if (blocked.includes(host)) {
      throw new Error("Blocked host");
    }
    if (
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)
    ) {
      throw new Error("Private network blocked");
    }

    const fetchRes = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!fetchRes.ok) {
      throw new Error(`Failed to fetch URL: ${fetchRes.status} ${fetchRes.statusText}`);
    }

    const contentLength = fetchRes.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 5 * 1024 * 1024) {
      throw new Error("Response exceeds 5MB limit");
    }

    const html = await fetchRes.text();
    if (html.length > 5 * 1024 * 1024) {
      throw new Error("Response body exceeds 5MB limit");
    }

    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    res.json({
      text: article?.textContent?.trim() || "",
      title: article?.title?.trim() || "",
    });
  } catch (error) {
    logger.error(
      { err: (error as Error).message, route: "/api/fetch-url" },
      "URL fetch failed"
    );
    res.status(400).json({ error: (error as Error).message });
  }
});
