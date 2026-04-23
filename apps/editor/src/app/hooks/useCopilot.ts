import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EditorCore } from "@blud/editor-core";
import type { CopilotImageAttachment, CopilotSession } from "@/lib/copilot/types";
import { isCopilotConfigured, loadCopilotSettings } from "@/lib/copilot/settings";
import type { CopilotToolExecutionContext } from "@/lib/copilot/tool-executor";
import { appendSkillContextToPrompt, discoverCopilotSkills } from "@/lib/copilot/skills";

export type GeneratedGame = { title: string; html: string };

const EMPTY_SESSION: CopilotSession = {
  messages: [],
  activity: [],
  status: "idle",
  iterationCount: 0
};

type CopilotRuntime = {
  runAgenticLoop: typeof import("@/lib/copilot/agentic-loop").runAgenticLoop;
  createCopilotProvider: typeof import("@/lib/copilot/provider").createCopilotProvider;
  buildSystemPrompt: typeof import("@/lib/copilot/system-prompt").buildSystemPrompt;
  COPILOT_TOOL_DECLARATIONS: typeof import("@/lib/copilot/tool-declarations").COPILOT_TOOL_DECLARATIONS;
  GAME_TOOL_DECLARATIONS: typeof import("@/lib/copilot/tool-declarations").GAME_TOOL_DECLARATIONS;
  isGameGenerationPrompt: typeof import("@/lib/copilot/tool-declarations").isGameGenerationPrompt;
  executeTool: typeof import("@/lib/copilot/tool-executor").executeTool;
};

let copilotRuntimePromise: Promise<CopilotRuntime> | null = null;

function loadCopilotRuntime(): Promise<CopilotRuntime> {
  if (!copilotRuntimePromise) {
    copilotRuntimePromise = Promise.all([
      import("@/lib/copilot/agentic-loop"),
      import("@/lib/copilot/provider"),
      import("@/lib/copilot/system-prompt"),
      import("@/lib/copilot/tool-declarations"),
      import("@/lib/copilot/tool-executor")
    ]).then(([agenticLoop, provider, systemPrompt, toolDeclarations, toolExecutor]) => ({
      runAgenticLoop: agenticLoop.runAgenticLoop,
      createCopilotProvider: provider.createCopilotProvider,
      buildSystemPrompt: systemPrompt.buildSystemPrompt,
      COPILOT_TOOL_DECLARATIONS: toolDeclarations.COPILOT_TOOL_DECLARATIONS,
      GAME_TOOL_DECLARATIONS: toolDeclarations.GAME_TOOL_DECLARATIONS,
      isGameGenerationPrompt: toolDeclarations.isGameGenerationPrompt,
      executeTool: toolExecutor.executeTool
    }));
  }

  return copilotRuntimePromise;
}

function extractHtmlFromMessages(messages: CopilotSession["messages"]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "assistant" || !message.content) {
      continue;
    }

    const match = /```html\s*([\s\S]+?)```/i.exec(message.content);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

function cloneSession(updated: CopilotSession): CopilotSession {
  return {
    ...updated,
    messages: [...updated.messages],
    activity: [...updated.activity]
  };
}

export function useCopilot(editor: EditorCore, toolContext: CopilotToolExecutionContext = {}) {
  const [session, setSession] = useState<CopilotSession>(EMPTY_SESSION);
  const [configured, setConfigured] = useState(() => isCopilotConfigured());
  const [latestGame, setLatestGame] = useState<GeneratedGame | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const codexThreadIdRef = useRef<string | undefined>(undefined);
  const pendingGameTitleRef = useRef<string | null>(null);

  const publishSession = useCallback((updated: CopilotSession) => {
    const nextSession = cloneSession(updated);

    startTransition(() => {
      setSession(nextSession);
    });
  }, []);

  const mergedToolContext = useMemo<CopilotToolExecutionContext>(
    () => ({
      ...toolContext,
      onGeneratedGame: (title: string, _html: string) => {
        pendingGameTitleRef.current = title;
      }
    }),
    [toolContext]
  );

  useEffect(() => {
    const check = () => setConfigured(isCopilotConfigured());

    window.addEventListener("focus", check);
    window.addEventListener("storage", check);

    return () => {
      window.removeEventListener("focus", check);
      window.removeEventListener("storage", check);
    };
  }, []);

  useEffect(() => {
    if (session.status !== "idle" || !pendingGameTitleRef.current) {
      return;
    }

    const title = pendingGameTitleRef.current;
    pendingGameTitleRef.current = null;

    const html = extractHtmlFromMessages(session.messages);
    if (html) {
      setLatestGame({ title, html });
    }
  }, [session.status, session.messages]);

  const sendMessage = useCallback(
    async (prompt: string, images?: CopilotImageAttachment[]) => {
      const settings = loadCopilotSettings();

      if (!isCopilotConfigured(settings)) {
        setSession((previous) => ({
          ...previous,
          status: "error",
          error:
            settings.provider === "codex"
              ? 'Codex not configured. Run "codex login" in your terminal.'
              : "No API key configured. Open Copilot settings to add one."
        }));
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      const [
        {
          runAgenticLoop,
          createCopilotProvider,
          buildSystemPrompt,
          COPILOT_TOOL_DECLARATIONS,
          GAME_TOOL_DECLARATIONS,
          isGameGenerationPrompt,
          executeTool
        },
        skillContext
      ] = await Promise.all([loadCopilotRuntime(), discoverCopilotSkills(prompt)]);

      const copilotProvider = createCopilotProvider(settings.provider);
      const systemPrompt = appendSkillContextToPrompt(buildSystemPrompt(editor), skillContext);
      const gameMode = isGameGenerationPrompt(prompt);
      const modeLabel = gameMode ? "game-generation" : "editor";
      const tools = gameMode ? GAME_TOOL_DECLARATIONS : COPILOT_TOOL_DECLARATIONS;

      console.log(
        `[COPILOT] Mode: ${gameMode ? "game-generation (1 tool)" : `editor (${tools.length} tools)`}`
      );

      const providerConfig = {
        apiKey: settings.provider === "gemini" ? settings.gemini.apiKey : "",
        model: settings.provider === "gemini" ? settings.gemini.model : settings.codex.model,
        temperature: settings.temperature
      };

      if (copilotProvider.kind === "session-based") {
        await copilotProvider.provider.runSession({
          messages: session.messages,
          activity: session.activity,
          userPrompt: prompt,
          tools,
          systemPrompt,
          providerConfig,
          providerId: settings.provider,
          modeLabel,
          skillContext,
          threadId: codexThreadIdRef.current,
          onThreadId: (threadId) => {
            codexThreadIdRef.current = threadId;
          },
          executeTool: (toolCall) => executeTool(editor, toolCall, mergedToolContext),
          onUpdate: publishSession,
          signal: controller.signal
        });
      } else {
        await runAgenticLoop(
          prompt,
          session.messages,
          {
            maxIterations: 25,
            provider: copilotProvider.provider,
            providerConfig,
            providerId: settings.provider,
            modeLabel,
            skillContext,
            existingActivity: session.activity,
            systemPrompt,
            tools,
            executeTool: (toolCall) => executeTool(editor, toolCall, mergedToolContext),
            onUpdate: publishSession
          },
          controller.signal,
          images
        );
      }

      abortRef.current = null;
    },
    [editor, mergedToolContext, publishSession, session.activity, session.messages]
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const clearHistory = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    codexThreadIdRef.current = undefined;
    pendingGameTitleRef.current = null;
    setSession(EMPTY_SESSION);
  }, []);

  const clearLatestGame = useCallback(() => setLatestGame(null), []);

  return {
    session,
    sendMessage,
    abort,
    clearHistory,
    isConfigured: configured,
    refreshConfigured: () => setConfigured(isCopilotConfigured()),
    latestGame,
    clearLatestGame
  };
}
