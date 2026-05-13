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

      const payload = (await response.json()) as CopilotResponse | { error?: string };

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
