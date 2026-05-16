import { FunctionCallingConfigMode, GoogleGenAI } from "@google/genai";
import type {
  CopilotMessage,
  CopilotResponse,
  CopilotToolCall,
  CopilotToolDeclaration
} from "../src/lib/copilot/types.js";

export const SERVER_GEMMA_MODEL = "gemma-4-31b-it";
const LIGHTNING_MODEL = "lightning-ai/gemma-4-31B-it";
const LIGHTNING_API_URL = "https://lightning.ai/api/v1/chat/completions";

export type CopilotGenerateRequest = {
  messages: CopilotMessage[];
  tools: CopilotToolDeclaration[];
  systemPrompt: string;
  temperature: number;
};

function convertMessages(messages: CopilotMessage[]) {
  const contents: Record<string, unknown>[] = [];

  for (const message of messages) {
    if (message.role === "user") {
      const parts: Record<string, unknown>[] = [];
      if (message.images && message.images.length > 0) {
        for (const img of message.images) {
          const base64 = img.dataUrl.split(",")[1] ?? img.dataUrl;
          parts.push({ inlineData: { mimeType: img.mimeType, data: base64 } });
        }
      }
      if (message.content) {
        parts.push({ text: message.content });
      }
      contents.push({ role: "user", parts });
    } else if (message.role === "assistant") {
      if (message.rawParts && message.rawParts.length > 0) {
        contents.push({ role: "model", parts: message.rawParts });
      } else {
        const parts: Record<string, unknown>[] = [];

        if (message.content) {
          parts.push({ text: message.content });
        }

        if (message.toolCalls) {
          for (const tc of message.toolCalls) {
            parts.push({ functionCall: { name: tc.name, args: tc.args } });
          }
        }

        if (parts.length > 0) {
          contents.push({ role: "model", parts });
        }
      }
    } else if (message.role === "tool" && message.toolResults) {
      const parts = message.toolResults.map((tr) => ({
        functionResponse: {
          name: tr.name,
          response: JSON.parse(tr.result) as Record<string, unknown>
        }
      }));

      contents.push({ role: "user", parts });
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

function isGeminiQuotaError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /resource_exhausted|quota|rate[- ]limit|429/i.test(message);
}

type LightningContentPart =
  | { type: "image_url"; image_url: { url: string } }
  | { type: "text"; text: string };

type LightningMessage =
  | {
      role: "assistant" | "user";
      content: LightningContentPart[];
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: {
          name: string;
          arguments: string;
        };
      }>;
    }
  | {
      role: "tool";
      tool_call_id: string;
      name: string;
      content: string;
    };

function convertMessagesForLightning(messages: CopilotMessage[]) {
  const converted: LightningMessage[] = [];

  for (const message of messages) {
    if (message.role === "tool" && message.toolResults) {
      for (const toolResult of message.toolResults) {
        converted.push({
          role: "tool",
          tool_call_id: toolResult.callId,
          name: toolResult.name,
          content: toolResult.result
        });
      }
      continue;
    }

    const content: LightningContentPart[] = [];

    if (message.images?.length) {
      for (const image of message.images) {
        content.push({
          type: "image_url",
          image_url: { url: image.dataUrl }
        });
      }
    }

    if (message.content) {
      content.push({ type: "text", text: message.content });
    }

    if (message.role === "assistant" && message.toolCalls?.length) {
      converted.push({
        role: "assistant",
        content: content.length > 0 ? content : [{ type: "text", text: "" }],
        tool_calls: message.toolCalls.map((toolCall) => ({
          id: toolCall.id,
          type: "function",
          function: {
            name: toolCall.name,
            arguments: JSON.stringify(toolCall.args)
          }
        }))
      });
      continue;
    }

    if (content.length > 0) {
      converted.push({
        role: message.role === "assistant" ? "assistant" : "user",
        content
      });
    }
  }

  return converted;
}

function convertToolsForLightning(tools: CopilotToolDeclaration[]) {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));
}

async function generateViaLightning(request: CopilotGenerateRequest): Promise<CopilotResponse> {
  const apiKey = process.env.LIGHTNING_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing LIGHTNING_API_KEY in the server environment.");
  }

  const response = await fetch(LIGHTNING_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: LIGHTNING_MODEL,
      messages: [
        {
          role: "system",
          content: [{ type: "text", text: request.systemPrompt }]
        },
        ...convertMessagesForLightning(request.messages)
      ],
      tools: convertToolsForLightning(request.tools),
      tool_choice: "auto",
      temperature: request.temperature
    })
  });

  const payload = await response.json().catch(() => null) as {
    choices?: Array<{
      message?: {
        content?: Array<{ text?: string; type?: string }> | string | null;
        tool_calls?: Array<{
          id?: string;
          function?: {
            arguments?: string;
            name?: string;
          };
        }>;
      };
    }>;
    error?: {
      message?: string;
    };
  } | null;

  if (!response.ok) {
    throw new Error(payload?.error?.message || `Lightning fallback failed with status ${response.status}.`);
  }

  const choice = payload?.choices?.[0]?.message;
  const content = choice?.content;
  const text = Array.isArray(content)
    ? content.map((part) => part.text ?? "").join("")
    : typeof content === "string"
      ? content
      : "";

  const toolCalls: CopilotToolCall[] = (choice?.tool_calls ?? []).map((toolCall) => ({
    id: toolCall.id ?? `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: toolCall.function?.name ?? "",
    args: safeParseToolArguments(toolCall.function?.arguments)
  }));

  return {
    text,
    toolCalls,
    rawParts: text ? [{ text }] : []
  };
}

function safeParseToolArguments(value: string | undefined): Record<string, unknown> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export async function generateCopilotContent(
  request: CopilotGenerateRequest
): Promise<CopilotResponse> {
  const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY in the server environment.");
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: SERVER_GEMMA_MODEL,
      contents: convertMessages(request.messages),
      config: {
        systemInstruction: request.systemPrompt,
        temperature: request.temperature,
        tools: [{ functionDeclarations: convertToolDeclarations(request.tools) }],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.AUTO
          }
        }
      }
    });

    const rawParts: unknown[] =
      (response.candidates?.[0]?.content?.parts as unknown[]) ?? [];

    const toolCalls: CopilotToolCall[] = [];
    const functionCalls = response.functionCalls;

    if (functionCalls) {
      for (const fc of functionCalls) {
        toolCalls.push({
          id: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: fc.name ?? "",
          args: (fc.args as Record<string, unknown>) ?? {}
        });
      }
    }

    return {
      text: response.text ?? "",
      toolCalls,
      rawParts
    };
  } catch (error) {
    if (!isGeminiQuotaError(error)) {
      throw error;
    }

    return generateViaLightning(request);
  }
}
