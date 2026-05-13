import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  generateNpcChatReply,
  type NpcChatRequest
} from "../../server/npc-chat-shared";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const payload = req.body as NpcChatRequest;
    return res.status(200).json({ text: await generateNpcChatReply(payload) });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "NPC reply failed."
    });
  }
}
