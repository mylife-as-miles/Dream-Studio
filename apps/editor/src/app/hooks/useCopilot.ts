import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EditorCore } from "@blud/editor-core";
import type { AiAssistantMode, CopilotImageAttachment, CopilotSession } from "@/lib/copilot/types";
import { isCopilotConfigured, loadCopilotSettings } from "@/lib/copilot/settings";
import type { CopilotToolExecutionContext } from "@/lib/copilot/tool-executor";
import { appendSkillContextToPrompt, discoverCopilotSkills } from "@/lib/copilot/skills";
import {
  buildMorphusPreviewHtml,
  createMorphusFilesFromAssistantContent,
  createMorphusFilesFromGame,
  inferMorphusFileLanguage,
  loadMorphusMemory,
  saveMorphusMemory,
  type MorphusFileRecord
} from "@/lib/copilot/morphus-memory";

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
  buildEditorSystemPrompt: typeof import("@/lib/copilot/system-prompt").buildEditorSystemPrompt;
  buildMorphusSystemPrompt: typeof import("@/lib/copilot/system-prompt").buildMorphusSystemPrompt;
  EDITOR_COPILOT_TOOL_DECLARATIONS: typeof import("@/lib/copilot/tool-declarations").EDITOR_COPILOT_TOOL_DECLARATIONS;
  GAME_TOOL_DECLARATIONS: typeof import("@/lib/copilot/tool-declarations").GAME_TOOL_DECLARATIONS;
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
      buildEditorSystemPrompt: systemPrompt.buildEditorSystemPrompt,
      buildMorphusSystemPrompt: systemPrompt.buildMorphusSystemPrompt,
      EDITOR_COPILOT_TOOL_DECLARATIONS: toolDeclarations.EDITOR_COPILOT_TOOL_DECLARATIONS,
      GAME_TOOL_DECLARATIONS: toolDeclarations.GAME_TOOL_DECLARATIONS,
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

function mergeMorphusFiles(
  existingFiles: MorphusFileRecord[],
  incomingFiles: MorphusFileRecord[]
): MorphusFileRecord[] {
  if (incomingFiles.length === 0) {
    return existingFiles;
  }

  const byPath = new Map(existingFiles.map((file) => [file.path, file]));

  for (const file of incomingFiles) {
    byPath.set(file.path, file);
  }

  return Array.from(byPath.values()).sort((a, b) => a.path.localeCompare(b.path));
}

function normalizeMorphusPath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\.?\//, "").trim();
}

function summarizeMorphusFile(file: MorphusFileRecord) {
  return {
    language: file.language,
    path: file.path,
    size: file.content.length,
    updatedAt: file.updatedAt
  };
}

async function exportMorphusFilesToWorkspace(files: MorphusFileRecord[]) {
  const response = await fetch("/api/morphus/export", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      files: files.map((file) => ({
        content: file.content,
        language: file.language,
        path: file.path
      }))
    })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || `Morphus export failed with status ${response.status}.`);
  }
}

export function useCopilot(
  editor: EditorCore,
  toolContext: CopilotToolExecutionContext = {},
  mode: AiAssistantMode = "copilot"
) {
  const [session, setSession] = useState<CopilotSession>(EMPTY_SESSION);
  const [configured, setConfigured] = useState(() => isCopilotConfigured());
  const [latestGame, setLatestGame] = useState<GeneratedGame | null>(null);
  const [files, setFiles] = useState<MorphusFileRecord[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const codexThreadIdRef = useRef<string | undefined>(undefined);
  const pendingGameTitleRef = useRef<string | null>(null);
  const memoryLoadedRef = useRef(false);
  const memoryKey = mode === "morphus" ? "morphus" : "copilot";
  const availableMorphusAudioFiles = useMemo(
    () => files
      .map((file) => file.path)
      .filter((path) => /^assets\/audio\//i.test(path))
      .sort((a, b) => a.localeCompare(b)),
    [files]
  );
  const availableMorphusFilePaths = useMemo(
    () => files
      .map((file) => file.path)
      .sort((a, b) => a.localeCompare(b)),
    [files]
  );

  const publishSession = useCallback((updated: CopilotSession) => {
    const nextSession = cloneSession(updated);

    startTransition(() => {
      setSession(nextSession);
    });
  }, []);

  const mergedToolContext = useMemo<CopilotToolExecutionContext>(
    () => ({
      ...toolContext,
      morphusCreateFile: (path: string, content: string) => {
        const normalizedPath = normalizeMorphusPath(path);
        if (!normalizedPath) {
          throw new Error("File path is required.");
        }
        if (files.some((file) => file.path === normalizedPath)) {
          throw new Error(`File already exists: ${normalizedPath}`);
        }

        const nextFile: MorphusFileRecord = {
          content,
          language: inferMorphusFileLanguage(normalizedPath),
          path: normalizedPath,
          updatedAt: Date.now()
        };
        const nextFiles = mergeMorphusFiles(files, [nextFile]);
        const html = buildMorphusPreviewHtml(nextFiles);
        setFiles(nextFiles);
        if (html) {
          setLatestGame((previousGame) => ({ title: previousGame?.title ?? "Edited Game", html }));
        }

        return { created: true, file: summarizeMorphusFile(nextFile) };
      },
      morphusListFiles: () => ({
        count: files.length,
        files: files.map(summarizeMorphusFile)
      }),
      morphusReadFile: (path: string) => {
        const normalizedPath = normalizeMorphusPath(path);
        const file = files.find((entry) => entry.path === normalizedPath);
        if (!file) {
          throw new Error(`File not found: ${normalizedPath}`);
        }

        return {
          content: file.content,
          file: summarizeMorphusFile(file)
        };
      },
      morphusRequestDeleteFile: (path: string, reason: string) => {
        const normalizedPath = normalizeMorphusPath(path);
        const file = files.find((entry) => entry.path === normalizedPath);
        if (!file) {
          throw new Error(`File not found: ${normalizedPath}`);
        }

        return {
          action: "delete_file",
          approvalRequired: true,
          file: summarizeMorphusFile(file),
          message: `Ask the user before deleting ${normalizedPath}.`,
          reason
        };
      },
      morphusRequestRenameFile: (fromPath: string, toPath: string, reason: string) => {
        const normalizedFromPath = normalizeMorphusPath(fromPath);
        const normalizedToPath = normalizeMorphusPath(toPath);
        const file = files.find((entry) => entry.path === normalizedFromPath);
        if (!file) {
          throw new Error(`File not found: ${normalizedFromPath}`);
        }
        if (!normalizedToPath) {
          throw new Error("Destination path is required.");
        }
        if (files.some((entry) => entry.path === normalizedToPath)) {
          throw new Error(`Destination already exists: ${normalizedToPath}`);
        }

        return {
          action: "rename_file",
          approvalRequired: true,
          fromPath: normalizedFromPath,
          message: `Ask the user before renaming ${normalizedFromPath} to ${normalizedToPath}.`,
          reason,
          toPath: normalizedToPath
        };
      },
      morphusWriteFile: (path: string, content: string) => {
        const normalizedPath = normalizeMorphusPath(path);
        const existingFile = files.find((file) => file.path === normalizedPath);
        if (!existingFile) {
          throw new Error(`File not found: ${normalizedPath}`);
        }

        const nextFile: MorphusFileRecord = {
          ...existingFile,
          content,
          language: inferMorphusFileLanguage(normalizedPath),
          updatedAt: Date.now()
        };
        const nextFiles = mergeMorphusFiles(files, [nextFile]);
        const html = buildMorphusPreviewHtml(nextFiles);
        setFiles(nextFiles);
        if (html) {
          setLatestGame((previousGame) => ({ title: previousGame?.title ?? "Edited Game", html }));
        }

        return { file: summarizeMorphusFile(nextFile), updated: true };
      },
      onGeneratedGame: (title: string, html: string, generatedFiles?: Array<{ content: string; path: string }>) => {
        const toolFiles = generatedFiles?.map((file) => ({
          content: file.content,
          language: inferMorphusFileLanguage(file.path),
          path: normalizeMorphusPath(file.path),
          updatedAt: Date.now()
        })) ?? [];
        const mergedFiles = mode === "morphus" ? mergeMorphusFiles(files, toolFiles) : toolFiles;
        const toolHtml = mode === "morphus" && mergedFiles.length > 0
          ? buildMorphusPreviewHtml(mergedFiles)
          : null;
        const resolvedHtml = toolHtml || html.trim();

        if (resolvedHtml) {
          const game = { title, html: resolvedHtml };
          setLatestGame(game);
          if (mode === "morphus") {
            setFiles(mergedFiles.length > 0 ? mergedFiles : createMorphusFilesFromGame(game));
          }
        }
        pendingGameTitleRef.current = title;
      }
    }),
    [files, mode, toolContext]
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
    let cancelled = false;
    void loadMorphusMemory(memoryKey).then((memory) => {
      if (cancelled) {
        return;
      }

      if (memory.session) {
        setSession(memory.session);
      }
      if (mode === "morphus" && memory.latestGame) {
        setLatestGame(memory.latestGame);
      }
      if (mode === "morphus") {
        setFiles(memory.files);
      }
      memoryLoadedRef.current = true;
    });

    return () => {
      cancelled = true;
    };
  }, [memoryKey, mode]);

  useEffect(() => {
    if (!memoryLoadedRef.current) {
      return;
    }

    void saveMorphusMemory({
      files: mode === "morphus" ? files : [],
      latestGame: mode === "morphus" ? latestGame : null,
      session,
      updatedAt: Date.now()
    }, memoryKey);
  }, [files, latestGame, memoryKey, mode, session]);

  useEffect(() => {
    if (mode !== "morphus" || files.length === 0) {
      return;
    }

    void exportMorphusFilesToWorkspace(files).catch((error) => {
      console.error("[MORPHUS] Workspace export failed:", error);
    });
  }, [files, mode]);

  useEffect(() => {
    if (session.status !== "idle" || !pendingGameTitleRef.current) {
      return;
    }

    const title = pendingGameTitleRef.current;
    pendingGameTitleRef.current = null;

    const latestAssistantMessage = findLatestAssistantContent(session.messages);
    const morphusFiles =
      mode === "morphus" && latestAssistantMessage
        ? createMorphusFilesFromAssistantContent(latestAssistantMessage)
        : [];
    const html = mode === "morphus"
      ? buildMorphusPreviewHtml(morphusFiles)
      : extractHtmlFromMessages(session.messages);

    if (html) {
      const game = { title, html };
      setLatestGame(game);
      if (mode === "morphus") {
        setFiles((previousFiles) => {
          const mergedFiles = mergeMorphusFiles(previousFiles, morphusFiles);
          return mergedFiles.length > 0 ? mergedFiles : createMorphusFilesFromGame(game);
        });
      }
    }
  }, [mode, session.status, session.messages]);

  useEffect(() => {
    if (mode !== "morphus" || session.status !== "idle" || (files.length > 0 && latestGame)) {
      return;
    }

    const latestAssistantMessage = findLatestAssistantContent(session.messages);
    if (!latestAssistantMessage) {
      return;
    }

    const morphusFiles = createMorphusFilesFromAssistantContent(latestAssistantMessage);
    const html = buildMorphusPreviewHtml(morphusFiles);
    if (!html) {
      return;
    }

    setFiles((previousFiles) => {
      const mergedFiles = mergeMorphusFiles(previousFiles, morphusFiles);
      return mergedFiles.length > 0 ? mergedFiles : createMorphusFilesFromGame({ title: "Generated Game", html });
    });
    setLatestGame((previousGame) => previousGame ?? { title: "Generated Game", html });
  }, [files.length, latestGame, mode, session.status, session.messages]);

  const sendMessage = useCallback(
    async (prompt: string, images?: CopilotImageAttachment[]) => {
      if (abortRef.current || session.status === "thinking" || session.status === "executing") {
        return;
      }

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
          buildEditorSystemPrompt,
          buildMorphusSystemPrompt,
          EDITOR_COPILOT_TOOL_DECLARATIONS,
          GAME_TOOL_DECLARATIONS,
          executeTool
        },
        skillContext
      ] = await Promise.all([loadCopilotRuntime(), discoverCopilotSkills(prompt)]);

      const copilotProvider = createCopilotProvider(settings.provider);
      const baseSystemPrompt =
        mode === "morphus" ? buildMorphusSystemPrompt() : buildEditorSystemPrompt(editor);
      const audioContext =
        mode === "morphus"
          ? `\n\n## Runtime Context\n- ElevenLabs audio is ${settings.elevenlabsApiKey ? "available" : "not configured"} in this browser.\n- Existing Morphus audio files: ${
            availableMorphusAudioFiles.length > 0
              ? availableMorphusAudioFiles.slice(0, 24).join(", ")
              : "none"
          }.\n- Existing Morphus project files: ${
            availableMorphusFilePaths.length > 0
              ? availableMorphusFilePaths.slice(0, 40).join(", ")
              : "none"
          }.\n- Reuse and edit the existing project files by default. On continue or follow-up requests, change only the files that need changes.\n- Reuse existing workspace audio by default. Only ask for new audio if the user explicitly requests it or a required sound category is missing.`
          : "";
      const systemPrompt = appendSkillContextToPrompt(`${baseSystemPrompt}${audioContext}`, skillContext);
      const modeLabel = mode === "morphus" ? "morphus" : "editor";
      const tools = mode === "morphus" ? GAME_TOOL_DECLARATIONS : EDITOR_COPILOT_TOOL_DECLARATIONS;

      console.log(
        `[COPILOT] Mode: ${mode === "morphus" ? "morphus (1 tool)" : `editor (${tools.length} tools)`}`
      );

      const providerConfig = {
        apiKey: "",
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
    [availableMorphusAudioFiles, availableMorphusFilePaths, editor, mergedToolContext, mode, publishSession, session.activity, session.messages]
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
    if (mode === "morphus") {
      setFiles([]);
      setLatestGame(null);
    }
    void saveMorphusMemory({
      files: [],
      latestGame: null,
      session: EMPTY_SESSION,
      updatedAt: Date.now()
    }, memoryKey);
  }, [memoryKey, mode]);

  const clearLatestGame = useCallback(() => setLatestGame(null), []);

  const saveFile = useCallback((path: string, content: string) => {
    setFiles((previous) => {
      const now = Date.now();
      const nextFiles = previous.some((file) => file.path === path)
        ? previous.map((file) => (file.path === path ? { ...file, content, updatedAt: now } : file))
        : [
            ...previous,
            {
              content,
              language: inferMorphusFileLanguage(path),
              path,
              updatedAt: now
            }
          ];

      const html = buildMorphusPreviewHtml(nextFiles);
      if (html) {
        setLatestGame((previousGame) =>
          previousGame ? { ...previousGame, html } : { title: "Edited Game", html }
        );
      }

      return nextFiles;
    });
  }, []);

  return {
    session,
    sendMessage,
    abort,
    clearHistory,
    isConfigured: configured,
    refreshConfigured: () => setConfigured(isCopilotConfigured()),
    latestGame,
    clearLatestGame,
    files,
    saveFile
  };
}

function findLatestAssistantContent(messages: CopilotSession["messages"]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role === "assistant" && message.content.trim()) {
      return message.content;
    }
  }

  return "";
}
