import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  generateCopilotContent,
  type CopilotGenerateRequest
} from "../../server/copilot-generate-shared";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const payload = req.body as CopilotGenerateRequest;
    return res.status(200).json(await generateCopilotContent(payload));
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Copilot generation failed."
    });
  }
}
