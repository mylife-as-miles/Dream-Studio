import { GoogleGenAI } from "@google/genai";
import { loadCopilotSettings } from "@/lib/copilot/settings";

export type PreviewNpcChatHistoryTurn = {
  role: "user" | "assistant";
  text: string;
};

/**
 * Single-turn NPC reply using the same Gemini API key/model as Copilot (localStorage).
 */
export async function generateNpcReply(params: {
  characterPrompt: string;
  history: PreviewNpcChatHistoryTurn[];
  npcName: string;
  userMessage: string;
}): Promise<string> {
  const settings = loadCopilotSettings();
  const apiKey = settings.gemini.apiKey.trim();

  if (!apiKey) {
    throw new Error(
      "Add a Gemini API key in Copilot settings to talk with NPCs during viewport preview."
    );
  }

  const model = settings.gemini.model;
  const systemInstruction = [
    `You are “${params.npcName}” in a real-time 3D game the designer is building.`,
    params.characterPrompt.trim() || "Stay in character. Keep answers to about 2–4 short sentences unless the player clearly wants more.",
    "Reply with spoken dialogue only — no asterisks, no stage directions, no markdown."
  ].join("\n");

  const contents: { parts: { text: string }[]; role: string }[] = [];

  for (const turn of params.history) {
    contents.push({
      role: turn.role === "user" ? "user" : "model",
      parts: [{ text: turn.text }]
    });
  }

  contents.push({
    role: "user",
    parts: [{ text: params.userMessage }]
  });

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      maxOutputTokens: 512,
      systemInstruction,
      temperature: 0.78
    }
  });

  const text = (response.text ?? "").trim();
  if (!text) {
    throw new Error("Gemini returned an empty reply.");
  }

  return text;
}
