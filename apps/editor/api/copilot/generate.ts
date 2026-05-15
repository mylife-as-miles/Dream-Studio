import { FunctionCallingConfigMode, GoogleGenAI } from "@google/genai";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const SERVER_GEMMA_MODEL = "gemma-4-31b-it";

type CopilotMessage = {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  images?: Array<{ dataUrl: string; mimeType: string }>;
  toolCalls?: Array<{ id: string; name: string; args: Record<string, unknown> }>;
  toolResults?: Array<{ callId: string; name: string; result: string }>;
  rawParts?: unknown[];
  timestamp: number;
};

type CopilotToolDeclaration = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

type CopilotGenerateRequest = {
  messages?: CopilotMessage[];
  tools?: CopilotToolDeclaration[];
  systemPrompt?: string;
  temperature?: number;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const payload = (req.body ?? {}) as CopilotGenerateRequest;
    const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();

    if (!apiKey) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY in the Vercel environment." });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: SERVER_GEMMA_MODEL,
      contents: convertMessages(payload.messages ?? []),
      config: {
        systemInstruction: payload.systemPrompt ?? "",
        temperature: typeof payload.temperature === "number" ? payload.temperature : 0.3,
        tools: [{ functionDeclarations: convertToolDeclarations(payload.tools ?? []) }],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.AUTO
          }
        }
      }
    });

    const toolCalls = (response.functionCalls ?? []).map((fc) => ({
      id: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: fc.name ?? "",
      args: (fc.args as Record<string, unknown>) ?? {}
    }));

    return res.status(200).json({
      text: response.text ?? "",
      toolCalls,
      rawParts: (response.candidates?.[0]?.content?.parts as unknown[]) ?? []
    });
  } catch (error) {
    console.error("[copilot/generate] error", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Copilot generation failed."
    });
  }
}

function convertMessages(messages: CopilotMessage[]) {
  const contents: Record<string, unknown>[] = [];

  for (const message of messages) {
    if (message.role === "user") {
      const parts: Record<string, unknown>[] = [];
      for (const img of message.images ?? []) {
        const base64 = img.dataUrl.split(",")[1] ?? img.dataUrl;
        parts.push({ inlineData: { mimeType: img.mimeType, data: base64 } });
      }
      if (message.content) {
        parts.push({ text: message.content });
      }
      contents.push({ role: "user", parts });
      continue;
    }

    if (message.role === "assistant") {
      if (message.rawParts && message.rawParts.length > 0) {
        contents.push({ role: "model", parts: message.rawParts });
        continue;
      }

      const parts: Record<string, unknown>[] = [];
      if (message.content) {
        parts.push({ text: message.content });
      }
      for (const tc of message.toolCalls ?? []) {
        parts.push({ functionCall: { name: tc.name, args: tc.args } });
      }
      if (parts.length > 0) {
        contents.push({ role: "model", parts });
      }
      continue;
    }

    if (message.role === "tool" && message.toolResults) {
      contents.push({
        role: "user",
        parts: message.toolResults.map((tr) => ({
          functionResponse: {
            name: tr.name,
            response: JSON.parse(tr.result) as Record<string, unknown>
          }
        }))
      });
    }
  }

  return contents;
}

function convertToolDeclarations(tools: CopilotToolDeclaration[]) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }));
}
