import type { CopilotSkillContext, CopilotSkillMatch } from "./types";

type SkillsApiResponse = {
  error?: string;
  matchedSkills?: CopilotSkillMatch[];
  rootPath?: string;
  skillCount?: number;
};

export async function discoverCopilotSkills(
  prompt: string
): Promise<CopilotSkillContext | undefined> {
  const trimmed = prompt.trim();

  if (!trimmed) {
    return undefined;
  }

  try {
    const url = new URL("/api/copilot/skills", window.location.origin);
    url.searchParams.set("prompt", trimmed);

    const response = await fetch(url.toString());
    if (!response.ok) {
      return undefined;
    }

    const payload = (await response.json()) as SkillsApiResponse;
    if (!payload.rootPath) {
      return undefined;
    }

    return {
      matchedSkills: Array.isArray(payload.matchedSkills) ? payload.matchedSkills.slice(0, 3) : [],
      rootPath: payload.rootPath
    };
  } catch {
    return undefined;
  }
}

export function appendSkillContextToPrompt(
  systemPrompt: string,
  skillContext?: CopilotSkillContext
) {
  if (!skillContext || skillContext.matchedSkills.length === 0) {
    return systemPrompt;
  }

  const skillLines = skillContext.matchedSkills
    .map(
      (skill, index) =>
        `${index + 1}. ${skill.name} - ${skill.description}\n` +
        `   Path: ${skill.path}\n` +
        `   Guidance: ${skill.excerpt}`
    )
    .join("\n");

  return `${systemPrompt}

## Local Skill Hints
Relevant Antigravity skills from ${skillContext.rootPath} matched this request.
- Use them as workflow guidance, not as replacements for the scene tools.
- Keep the execution order legible through concise assistant notes when useful.
- Favor clear discovery -> action -> verification sequencing.

${skillLines}`;
}
