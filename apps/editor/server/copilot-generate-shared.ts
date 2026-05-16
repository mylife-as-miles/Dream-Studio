import { FunctionCallingConfigMode, GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import type {
  CopilotMessage,
  CopilotResponse,
  CopilotToolCall,
  CopilotToolDeclaration
} from "../src/lib/copilot/types.js";

export const SERVER_GEMMA_MODEL = "gemma-4-31b-it";
const GEMINI_FLASH_FALLBACK_MODEL = "gemini-3-flash-preview";
const LIGHTNING_MODEL = "lightning-ai/gemma-4-31B-it";
const LIGHTNING_API_URL = "https://lightning.ai/api/v1/chat/completions";
const NVIDIA_MODEL = "minimaxai/minimax-m2.7";
const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const PRIMARY_TIMEOUT_MS = 14_000;
const FALLBACK_TIMEOUT_MS = 8_000;

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

function isTimeoutError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /timed out|timeout|aborted|aborterror/i.test(message);
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
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

type LightningPayload = {
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
  error?: { message?: string } | string;
  message?: string;
  detail?: string;
} | null;

type LightningChatPayload = {
  model: string;
  messages: Array<LightningMessage | { role: "system"; content: string } | { role: "assistant" | "user"; content: string }>;
  temperature: number;
  tools?: ReturnType<typeof convertToolsForLightning>;
  tool_choice?: "auto";
};

class LightningRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "LightningRequestError";
  }
}

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

function convertMessagesForLightningTextOnly(messages: CopilotMessage[]) {
  const converted: Array<{ role: "assistant" | "user"; content: string }> = [];

  for (const message of messages) {
    if (message.role === "tool" && message.toolResults) {
      for (const toolResult of message.toolResults) {
        converted.push({
          role: "user",
          content: `Tool result from ${toolResult.name}: ${toolResult.result}`
        });
      }
      continue;
    }

    const imageNotice = message.images?.length
      ? `\n[${message.images.length} attached image${message.images.length === 1 ? "" : "s"} omitted in fallback mode]`
      : "";
    const toolCallNotice = message.toolCalls?.length
      ? `\n[Previous tool calls: ${message.toolCalls.map((toolCall) => toolCall.name).join(", ")}]`
      : "";
    const content = `${message.content ?? ""}${imageNotice}${toolCallNotice}`.trim();

    if (content) {
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

  const tools = convertToolsForLightning(request.tools);
  const toolPayload: LightningChatPayload = {
    model: LIGHTNING_MODEL,
    messages: [
      {
        role: "system",
        content: request.systemPrompt
      },
      ...convertMessagesForLightning(request.messages)
    ],
    temperature: request.temperature
  };

  if (tools.length > 0) {
    toolPayload.tools = tools;
    toolPayload.tool_choice = "auto";
  }

  try {
    return await withTimeout(
      requestLightningCompletion(apiKey, toolPayload),
      FALLBACK_TIMEOUT_MS,
      "Lightning fallback",
    );
  } catch (error) {
    if (!(error instanceof LightningRequestError) || ![400, 422].includes(error.status)) {
      throw error;
    }

    return withTimeout(
      requestLightningCompletion(apiKey, {
        model: LIGHTNING_MODEL,
        messages: [
          {
            role: "system",
            content: `${request.systemPrompt}\n\nLightning fallback is running in text-only mode because the provider rejected the tool-call request. If you need an action, describe the exact next step clearly.`
          },
          ...convertMessagesForLightningTextOnly(request.messages)
        ],
        temperature: request.temperature
      }),
      FALLBACK_TIMEOUT_MS,
      "Lightning text-only fallback",
    );
  }
}

async function requestLightningCompletion(
  apiKey: string,
  body: LightningChatPayload
): Promise<CopilotResponse> {
  const response = await fetch(LIGHTNING_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const rawBody = await response.text();
  const payload = parseLightningPayload(rawBody);

  if (!response.ok) {
    const message = readLightningError(payload, rawBody)
      || `Lightning fallback failed with status ${response.status}.`;
    throw new LightningRequestError(message, response.status);
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

function parseLightningPayload(rawBody: string): LightningPayload {
  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody) as LightningPayload;
  } catch {
    return null;
  }
}

function readLightningError(payload: LightningPayload, rawBody: string) {
  if (typeof payload?.error === "string") {
    return payload.error;
  }

  return payload?.error?.message
    || payload?.message
    || payload?.detail
    || rawBody.replace(/\s+/g, " ").trim();
}

function formatFallbackError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message || "unknown error";
}

async function generateViaNvidia(request: CopilotGenerateRequest): Promise<CopilotResponse> {
  const apiKey = process.env.NVIDIA_API_KEY?.trim() || process.env.NVAPI_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing NVIDIA_API_KEY in the server environment.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FALLBACK_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(NVIDIA_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        messages: [
          {
            role: "system",
            content: `${request.systemPrompt}\n\nYou are running as the final NVIDIA fallback after Gemini and Lightning failed. Respond with clear text instructions or code-oriented guidance.`
          },
          ...convertMessagesForLightningTextOnly(request.messages)
        ],
        temperature: request.temperature,
        top_p: 0.95,
        max_tokens: 1024,
        stream: false
      })
    });
  } finally {
    clearTimeout(timeout);
  }

  const rawBody = await response.text();
  const payload = parseLightningPayload(rawBody);

  if (!response.ok) {
    throw new Error(readLightningError(payload, rawBody) || `NVIDIA fallback failed with status ${response.status}.`);
  }

  const choice = payload?.choices?.[0]?.message;
  const content = choice?.content;
  const text = Array.isArray(content)
    ? content.map((part) => part.text ?? "").join("")
    : typeof content === "string"
      ? content
      : "";

  return {
    text,
    toolCalls: [],
    rawParts: text ? [{ text }] : []
  };
}

async function generateViaGeminiFlash(request: CopilotGenerateRequest): Promise<CopilotResponse> {
  const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY in the server environment.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const textOnlyMessages = convertMessagesForLightningTextOnly(request.messages)
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");

  const response = await withTimeout(
    ai.models.generateContent({
      model: GEMINI_FLASH_FALLBACK_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: textOnlyMessages || "Continue the current editor task."
            }
          ]
        }
      ],
      config: {
        systemInstruction: `${request.systemPrompt}\n\nYou are running as the final fast Gemini Flash fallback after Gemini primary, Lightning, and NVIDIA failed or timed out. Return JSON with a single string field named response. Keep the response concise and actionable.`,
        temperature: request.temperature,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH
        },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            response: {
              type: Type.STRING
            }
          },
          required: ["response"]
        }
      }
    }),
    FALLBACK_TIMEOUT_MS,
    "Gemini Flash fallback",
  );

  const text = readGeminiFlashText(response.text ?? "");

  return {
    text,
    toolCalls: [],
    rawParts: text ? [{ text }] : []
  };
}

function readGeminiFlashText(raw: string) {
  try {
    const parsed = JSON.parse(raw) as { response?: unknown };
    return typeof parsed.response === "string" ? parsed.response : raw;
  } catch {
    return raw;
  }
}

async function generateViaProviderFallbacks(request: CopilotGenerateRequest): Promise<CopilotResponse> {
  try {
    return await generateViaLightning(request);
  } catch (lightningError) {
    try {
      return await generateViaNvidia(request);
    } catch (nvidiaError) {
      try {
        return await generateViaGeminiFlash(request);
      } catch (geminiFlashError) {
        throw new Error(
          `Lightning fallback failed: ${formatFallbackError(lightningError)} NVIDIA fallback failed: ${formatFallbackError(nvidiaError)} Gemini Flash fallback failed: ${formatFallbackError(geminiFlashError)}`
        );
      }
    }
  }
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
    return generateViaProviderFallbacks(request).catch((error: unknown) => {
      throw new Error(`Missing GEMINI_API_KEY in the server environment, and all fallbacks failed: ${
        error instanceof Error ? error.message : String(error ?? "unknown error")
      }`);
    });
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await withTimeout(
      ai.models.generateContent({
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
      }),
      PRIMARY_TIMEOUT_MS,
      "Primary Gemini generation",
    );

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
    if (!isGeminiQuotaError(error) && !isTimeoutError(error)) {
      throw error;
    }

    return generateViaProviderFallbacks(request).catch((fallbackError: unknown) => {
      const reason = isTimeoutError(error) ? "Gemini timed out" : "Gemini quota was reached";
      throw new Error(`${reason}, and all fallbacks failed: ${formatFallbackError(fallbackError)}`);
    });
  }
}
