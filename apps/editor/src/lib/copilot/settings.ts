import type { CopilotSettings, CodexModelId, GeminiModelId } from "./types";

const STORAGE_KEY = "web-hammer:copilot";

const CODEX_MODELS: CodexModelId[] = ["gpt-5.4", "gpt-5.3-codex", "gpt-5.1-codex-max", "gpt-4.1", "gpt-4.1-mini", "codex-mini-latest", "o3", "o4-mini"];
const GEMINI_MODELS: GeminiModelId[] = ["gemma-4-31b-it", "gemini-3-flash-preview", "gemini-3.1-pro-preview", "gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash-exp"];
const SERVER_GEMMA_MODEL: GeminiModelId = "gemma-server";

const DEFAULT_SETTINGS: CopilotSettings = {
  provider: "gemini",
  gemini: { model: SERVER_GEMMA_MODEL },
  codex: { model: "gpt-5.4" },
  temperature: 0.3,
  elevenlabsApiKey: ""
};

export function loadCopilotSettings(): CopilotSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };

    const parsed = JSON.parse(raw);

    return {
      provider: "gemini",
      gemini: { model: SERVER_GEMMA_MODEL },
      codex: {
        model: isCodexModel(parsed.codex?.model) ? parsed.codex.model : DEFAULT_SETTINGS.codex.model
      },
      temperature: validTemperature(parsed.temperature),
      elevenlabsApiKey: typeof parsed.elevenlabsApiKey === "string" ? parsed.elevenlabsApiKey : ""
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveCopilotSettings(settings: CopilotSettings): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...settings,
      provider: "gemini",
      gemini: { model: SERVER_GEMMA_MODEL }
    })
  );
}

export function isCopilotConfigured(settings?: CopilotSettings): boolean {
  settings ?? loadCopilotSettings();
  // Gemini/Gemma is configured server-side through Vercel environment variables.
  // The browser never receives or stores the API key.
  return true;
}

function isCodexModel(v: unknown): v is CodexModelId {
  return typeof v === "string" && (CODEX_MODELS as string[]).includes(v);
}

function validTemperature(v: unknown): number {
  return typeof v === "number" && v >= 0 && v <= 1 ? v : DEFAULT_SETTINGS.temperature;
}
