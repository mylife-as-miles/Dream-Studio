import type {
  CopilotMessage,
  CopilotProvider,
  CopilotProviderConfig,
  CopilotResponse,
  CopilotToolDeclaration
} from "./types";

export function createGeminiProvider(): CopilotProvider {
  return {
    async generateContent(
      messages: CopilotMessage[],
      tools: CopilotToolDeclaration[],
      systemPrompt: string,
      config: CopilotProviderConfig,
      signal?: AbortSignal
    ): Promise<CopilotResponse> {
      const response = await fetch("/api/copilot/generate", {
        body: JSON.stringify({
          messages,
          tools,
          systemPrompt,
          temperature: config.temperature
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST",
        signal
      });

      const payload = await readJsonOrError(response);

      if (!response.ok) {
        throw new Error(
          "error" in payload ? payload.error ?? "Copilot generation failed." : "Copilot generation failed."
        );
      }

      if (!("toolCalls" in payload)) {
        throw new Error("Copilot generation failed.");
      }

      return payload;
    }
  };
}

async function readJsonOrError(response: Response): Promise<CopilotResponse | { error?: string }> {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as CopilotResponse | { error?: string };
  } catch {
    return {
      error: text.replace(/\s+/g, " ").trim() || `HTTP ${response.status}`
    };
  }
}
