import type { VercelRequest, VercelResponse } from "@vercel/node";

import { materializeArticraftAsset } from "../../server/articraft-materialize.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const payload = typeof req.body === "string" ? JSON.parse(req.body) as unknown : req.body;
    return res.status(200).json(await materializeArticraftAsset(payload));
  } catch (error) {
    return res.status(500).json({
      error: "Articraft engine failed.",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Origin", "*");
}
