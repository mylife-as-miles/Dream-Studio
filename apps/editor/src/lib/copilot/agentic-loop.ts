import type {
  CopilotActivityItem,
  CopilotImageAttachment,
  CopilotMessage,
  CopilotProvider,
  CopilotProviderConfig,
  CopilotProviderId,
  CopilotSkillContext,
  CopilotSession,
  CopilotToolCall,
  CopilotToolDeclaration,
  CopilotToolResult
} from "./types";
import {
  createActivityItem,
  parseToolResult,
  summarizeToolArgs,
  summarizeToolResult,
  truncateText
} from "./activity";

export type AgenticLoopConfig = {
  maxIterations: number;
  provider: CopilotProvider;
  providerConfig: CopilotProviderConfig;
  providerId: CopilotProviderId;
  modeLabel: string;
  skillContext?: CopilotSkillContext;
  existingActivity?: CopilotActivityItem[];
  systemPrompt: string;
  tools: CopilotToolDeclaration[];
  executeTool: (call: CopilotToolCall) => CopilotToolResult;
  onUpdate: (session: CopilotSession) => void;
};

function uid(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const TAG = "[COPILOT]";

export async function runAgenticLoop(
  userPrompt: string,
  existingMessages: CopilotMessage[],
  config: AgenticLoopConfig,
  signal?: AbortSignal,
  images?: CopilotImageAttachment[]
): Promise<CopilotSession> {
  console.group(`${TAG} Session start`);
  console.log(`${TAG} User prompt:`, userPrompt);
  console.log(`${TAG} Model:`, config.providerConfig.model);
  console.log(`${TAG} Temperature:`, config.providerConfig.temperature);
  console.log(`${TAG} Tools available:`, config.tools.map((tool) => tool.name));
  console.log(`${TAG} System prompt:\n`, config.systemPrompt);
  console.log(`${TAG} Existing messages:`, existingMessages.length);
  console.groupEnd();

  const messages: CopilotMessage[] = [
    ...existingMessages,
    {
      id: uid(),
      role: "user",
      content: userPrompt,
      images: images && images.length > 0 ? images : undefined,
      timestamp: Date.now()
    }
  ];
  const activity: CopilotActivityItem[] = [...(config.existingActivity ?? [])];

  const session: CopilotSession = {
    messages,
    activity,
    status: "thinking",
    iterationCount: 0,
    activeSkills: config.skillContext?.matchedSkills,
    providerId: config.providerId,
    modelId: config.providerConfig.model,
    modeLabel: config.modeLabel,
    skillRootPath: config.skillContext?.rootPath
  };

  const emitUpdate = () =>
    config.onUpdate({
      ...session,
      messages: [...messages],
      activity: [...activity]
    });

  const pushActivity = (item: Omit<CopilotActivityItem, "id" | "timestamp">) => {
    activity.push(createActivityItem(item));
  };

  pushActivity({
    kind: "session",
    title: "Session started",
    detail: `${config.modeLabel} mode on ${config.providerId} (${config.providerConfig.model}) with ${config.tools.length} tools.`,
    tone: "info"
  });
  if (config.skillContext && config.skillContext.matchedSkills.length > 0) {
    pushActivity({
      kind: "session",
      title: "Skill context loaded",
      detail: `${config.skillContext.matchedSkills.map((skill) => skill.name).join(", ")} from ${config.skillContext.rootPath}`,
      tone: "info"
    });
  }
  emitUpdate();

  for (let iteration = 0; iteration < config.maxIterations; iteration++) {
    const stepNumber = iteration + 1;

    if (signal?.aborted) {
      console.log(`${TAG} Aborted at iteration ${stepNumber}`);
      session.status = "aborted";
      pushActivity({
        kind: "status",
        title: "Run stopped",
        detail: `Stopped before step ${stepNumber} finished.`,
        iteration: stepNumber,
        status: "aborted",
        tone: "warning"
      });
      emitUpdate();
      return session;
    }

    session.status = "thinking";
    session.iterationCount = stepNumber;
    pushActivity({
      kind: "step",
      title: `Step ${stepNumber}`,
      detail: `Sending ${messages.length} messages to ${config.providerConfig.model}.`,
      iteration: stepNumber,
      tone: "info"
    });
    emitUpdate();

    console.group(`${TAG} Iteration ${stepNumber}`);
    console.log(`${TAG} Sending ${messages.length} messages to LLM...`);

    let response;
    let modelElapsedMs = 0;

    try {
      const startedAt = performance.now();
      response = await config.provider.generateContent(
        messages,
        config.tools,
        config.systemPrompt,
        config.providerConfig,
        signal
      );
      modelElapsedMs = Math.round(performance.now() - startedAt);
      console.log(`${TAG} LLM responded in ${modelElapsedMs}ms`);
    } catch (error) {
      console.error(`${TAG} LLM error:`, error);
      console.groupEnd();

      if (error instanceof DOMException && error.name === "AbortError") {
        session.status = "aborted";
        pushActivity({
          kind: "status",
          title: "Run stopped",
          detail: `Stopped during step ${stepNumber}.`,
          iteration: stepNumber,
          status: "aborted",
          tone: "warning"
        });
        emitUpdate();
        return session;
      }

      const errorMessage = error instanceof Error ? error.message : "Unknown API error";
      session.status = "error";
      session.error = errorMessage;
      pushActivity({
        kind: "error",
        title: "Model request failed",
        detail: errorMessage,
        iteration: stepNumber,
        status: "error",
        tone: "error"
      });
      emitUpdate();
      return session;
    }

    if (!response.toolCalls || response.toolCalls.length === 0) {
      console.log(`${TAG} Final text response:`, response.text);
      console.groupEnd();
      pushActivity({
        kind: "status",
        title: "Model completed",
        detail: `Final response received in ${modelElapsedMs}ms.`,
        iteration: stepNumber,
        tone: "success"
      });

      messages.push({
        id: uid(),
        role: "assistant",
        content: response.text,
        rawParts: response.rawParts,
        timestamp: Date.now()
      });

      pushActivity({
        kind: "assistant",
        title: "Final response ready",
        detail: response.text ? truncateText(response.text) : "Completed without additional text.",
        iteration: stepNumber,
        tone: "success"
      });

      session.status = "idle";
      session.messages = messages;
      emitUpdate();
      return session;
    }

    console.log(`${TAG} Text:`, response.text || "(none)");
    console.log(`${TAG} Tool calls (${response.toolCalls.length}):`);
    for (const toolCall of response.toolCalls) {
      console.log(`  ${TAG} -> ${toolCall.name}`, JSON.stringify(toolCall.args, null, 2));
    }
    pushActivity({
      kind: "status",
      title: "Model requested actions",
      detail: `${response.toolCalls.length} tool call${response.toolCalls.length === 1 ? "" : "s"} received in ${modelElapsedMs}ms.`,
      iteration: stepNumber,
      tone: "info"
    });

    messages.push({
      id: uid(),
      role: "assistant",
      content: response.text,
      toolCalls: response.toolCalls,
      rawParts: response.rawParts,
      timestamp: Date.now()
    });

    if (response.text.trim()) {
      pushActivity({
        kind: "assistant",
        title: "Assistant note",
        detail: truncateText(response.text),
        iteration: stepNumber,
        tone: "info"
      });
    }

    for (const toolCall of response.toolCalls) {
      pushActivity({
        kind: "tool_call",
        title: `Calling ${toolCall.name}`,
        detail: summarizeToolArgs(toolCall.args),
        iteration: stepNumber,
        toolCall,
        tone: "info"
      });
    }

    session.status = "executing";
    emitUpdate();

    const toolResults: CopilotToolResult[] = [];

    for (const toolCall of response.toolCalls) {
      if (signal?.aborted) {
        console.log(`${TAG} Aborted during tool execution`);
        console.groupEnd();
        session.status = "aborted";
        pushActivity({
          kind: "status",
          title: "Run stopped",
          detail: `Stopped while ${toolCall.name} was executing.`,
          iteration: stepNumber,
          status: "aborted",
          tone: "warning"
        });
        emitUpdate();
        return session;
      }

      const startedAt = performance.now();
      const result = config.executeTool(toolCall);
      const elapsed = Math.round(performance.now() - startedAt);

      const parsed = parseToolResult(result.result);
      if (parsed.success === false) {
        console.warn(`  ${TAG} FAIL ${toolCall.name} (${elapsed}ms):`, parsed.error);
      } else {
        console.log(`  ${TAG} OK ${toolCall.name} (${elapsed}ms):`, result.result);
      }

      toolResults.push(result);
      pushActivity({
        kind: "tool_result",
        title: parsed.success ? `${toolCall.name} completed` : `${toolCall.name} failed`,
        detail: summarizeToolResult(result.result),
        iteration: stepNumber,
        toolResult: result,
        elapsedMs: elapsed,
        tone: parsed.success ? "success" : "error"
      });
      emitUpdate();
    }

    messages.push({
      id: uid(),
      role: "tool",
      content: "",
      toolResults,
      timestamp: Date.now()
    });
    pushActivity({
      kind: "status",
      title: "Tool batch finished",
      detail: `${toolResults.length} tool result${toolResults.length === 1 ? "" : "s"} returned to the model.`,
      iteration: stepNumber,
      tone: "info"
    });

    console.groupEnd();
    emitUpdate();
  }

  console.warn(`${TAG} Hit max iterations (${config.maxIterations})`);

  messages.push({
    id: uid(),
    role: "assistant",
    content: "Reached maximum iterations. Stopping here.",
    timestamp: Date.now()
  });

  session.status = "idle";
  session.messages = messages;
  pushActivity({
    kind: "status",
    title: "Stopped at iteration limit",
    detail: `Reached the ${config.maxIterations} step cap.`,
    status: "idle",
    tone: "warning"
  });
  emitUpdate();
  return session;
}
