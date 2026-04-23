import { readdir, readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";

type SkillIndexEntry = {
  description: string;
  excerpt: string;
  haystack: string;
  name: string;
  path: string;
};

type SkillIndex = {
  entries: SkillIndexEntry[];
  rootPath: string;
};

type SkillMatch = {
  description: string;
  excerpt: string;
  name: string;
  path: string;
  score: number;
};

const DEFAULT_SKILLS_ROOT = join(homedir(), ".gemini", "antigravity", "skills");
const STOP_WORDS = new Set([
  "able",
  "about",
  "after",
  "around",
  "build",
  "copilot",
  "could",
  "from",
  "have",
  "just",
  "make",
  "process",
  "show",
  "that",
  "their",
  "them",
  "there",
  "they",
  "this",
  "use",
  "want",
  "with",
  "would"
]);

let skillsIndexPromise: Promise<SkillIndex> | null = null;

export function createAntigravitySkillsApiPlugin(): Plugin {
  return {
    name: "antigravity-skills-api",
    configureServer(server) {
      registerAntigravitySkillsApi(server);
    },
    configurePreviewServer(server) {
      registerAntigravitySkillsApi(server);
    }
  };
}

function registerAntigravitySkillsApi(
  server: Pick<ViteDevServer, "middlewares"> | Pick<PreviewServer, "middlewares">
) {
  server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const pathname = req.url?.split("?")[0];

    if (req.method !== "GET" || pathname !== "/api/copilot/skills") {
      next();
      return;
    }

    try {
      const requestUrl = new URL(req.url ?? "/api/copilot/skills", "http://localhost");
      const prompt = requestUrl.searchParams.get("prompt") ?? "";
      const result = await findRelevantSkills(prompt);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : "Failed to load Antigravity skills.",
        matchedSkills: [],
        rootPath: getSkillsRoot(),
        skillCount: 0
      });
    }
  });
}

async function findRelevantSkills(prompt: string) {
  const index = await loadSkillsIndex();
  const normalizedPrompt = normalizeText(prompt);
  const promptTokens = tokenize(prompt);

  const matchedSkills = index.entries
    .map((entry) => ({
      ...entry,
      score: scoreSkill(entry, normalizedPrompt, promptTokens)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .slice(0, 4)
    .map<SkillMatch>((entry) => ({
      description: entry.description,
      excerpt: entry.excerpt,
      name: entry.name,
      path: entry.path,
      score: entry.score
    }));

  return {
    matchedSkills,
    rootPath: index.rootPath,
    skillCount: index.entries.length
  };
}

async function loadSkillsIndex(): Promise<SkillIndex> {
  if (!skillsIndexPromise) {
    skillsIndexPromise = buildSkillsIndex().catch((error) => {
      skillsIndexPromise = null;
      throw error;
    });
  }

  return skillsIndexPromise;
}

async function buildSkillsIndex(): Promise<SkillIndex> {
  const rootPath = getSkillsRoot();
  const entries = await readdir(rootPath, { withFileTypes: true });
  const indexedSkills = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const skillPath = join(rootPath, entry.name, "SKILL.md");

        try {
          const source = await readFile(skillPath, "utf8");
          const { description, excerpt, name } = parseSkillMarkdown(source, entry.name);

          return {
            description,
            excerpt,
            haystack: normalizeText([name, description, excerpt].join(" ")),
            name,
            path: skillPath
          } satisfies SkillIndexEntry;
        } catch {
          return null;
        }
      })
  );

  return {
    entries: indexedSkills.filter((entry): entry is SkillIndexEntry => Boolean(entry)),
    rootPath
  };
}

function getSkillsRoot() {
  return process.env.BLUD_COPILOT_SKILLS_DIR?.trim() || DEFAULT_SKILLS_ROOT;
}

function parseSkillMarkdown(source: string, fallbackName: string) {
  const frontmatterMatch = source.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*/);
  const frontmatter = frontmatterMatch?.[1] ?? "";
  const body = frontmatterMatch ? source.slice(frontmatterMatch[0].length) : source;
  const name = readFrontmatterField(frontmatter, "name") || fallbackName;
  const description = readFrontmatterField(frontmatter, "description") || firstMeaningfulLine(body);
  const excerpt = buildExcerpt(body);

  return {
    description,
    excerpt,
    name
  };
}

function readFrontmatterField(frontmatter: string, field: string) {
  const match = frontmatter.match(new RegExp(`^${field}:\\s*["']?(.+?)["']?$`, "im"));
  return match?.[1]?.trim() ?? "";
}

function firstMeaningfulLine(body: string) {
  const line = body
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find((value) => value && !value.startsWith("#") && !value.startsWith("-"));

  return line ?? "Local Antigravity skill";
}

function buildExcerpt(body: string) {
  const excerpt = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("```"))
    .slice(0, 4)
    .join(" ");

  return truncate(excerpt || "Workflow guidance available in SKILL.md.", 260);
}

function scoreSkill(entry: SkillIndexEntry, normalizedPrompt: string, promptTokens: string[]) {
  if (!normalizedPrompt) {
    return 0;
  }

  const normalizedName = normalizeText(entry.name);
  const normalizedDescription = normalizeText(entry.description);
  let score = 0;

  if (normalizedPrompt.includes(normalizedName)) {
    score += 10;
  }

  if (
    normalizedPrompt.includes("workflow") ||
    normalizedPrompt.includes("process") ||
    normalizedPrompt.includes("steps")
  ) {
    if (
      normalizedName.includes("workflow") ||
      normalizedDescription.includes("workflow") ||
      normalizedDescription.includes("orchestrat")
    ) {
      score += 4;
    }
  }

  if (normalizedPrompt.includes("copilot") || normalizedPrompt.includes("agent")) {
    if (normalizedName.includes("agent") || normalizedDescription.includes("agent")) {
      score += 3;
    }
  }

  if (normalizedPrompt.includes("show") || normalizedPrompt.includes("panel") || normalizedPrompt.includes("ui")) {
    if (normalizedDescription.includes("ui") || normalizedDescription.includes("design")) {
      score += 2;
    }
  }

  for (const token of promptTokens) {
    if (normalizedName.includes(token)) {
      score += 4;
      continue;
    }

    if (normalizedDescription.includes(token)) {
      score += 2;
      continue;
    }

    if (entry.haystack.includes(token)) {
      score += 1;
    }
  }

  return score;
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[`~!@#$%^&*()_+=[\]{};:'",.<>/?\\|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}
