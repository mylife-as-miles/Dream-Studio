import type { VercelRequest, VercelResponse } from "@vercel/node";

type UpsertFile = {
  code?: string;
  content?: string;
  data?: string;
  html?: string;
  name?: string;
  path?: string;
  text?: string;
};

type UpsertGameCodeRequest = {
  code?: string;
  content?: string;
  files?: UpsertFile[];
  gameCode?: string;
  gameId?: string;
  html?: string;
  pastedCode?: string;
  projectId?: string;
  source?: string;
  text?: string;
  title?: string;
};

const EMBEDDING_MODEL = "models/text-embedding-004";
const MAX_CHUNK_LENGTH = 4_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const payload = normalizePayload(req.body);
    const entries = normalizeCodeEntries(payload);

    if (entries.length === 0) {
      return res.status(400).json({ error: "No game code was provided." });
    }

    const pineconeApiKey = process.env.PINECONE_API_KEY?.trim();
    const pineconeHost = getPineconeHost();
    const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();

    if (!pineconeApiKey || !pineconeHost || !geminiApiKey) {
      return res.status(503).json({
        error: "RAG upsert is not configured.",
        missing: {
          geminiApiKey: !geminiApiKey,
          pineconeApiKey: !pineconeApiKey,
          pineconeHost: !pineconeHost
        }
      });
    }

    const chunks = entries.flatMap((entry) => chunkCode(entry.path, entry.content));
    const embeddings = await embedTexts(chunks.map((chunk) => chunk.text), geminiApiKey);
    const namespace = sanitizeNamespace(payload.projectId || payload.gameId || "dream-studio-games");
    const vectors = chunks.map((chunk, index) => ({
      id: `${namespace}:${chunk.path}:${chunk.index}`,
      values: embeddings[index],
      metadata: {
        content: chunk.text,
        gameId: payload.gameId ?? "",
        path: chunk.path,
        projectId: payload.projectId ?? "",
        title: payload.title ?? ""
      }
    }));

    await upsertPineconeVectors(pineconeHost, pineconeApiKey, namespace, vectors);

    return res.status(200).json({
      namespace,
      upserted: vectors.length
    });
  } catch (error) {
    console.error("[rag/upsert-game-code] error", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to upsert game code."
    });
  }
}

function normalizePayload(body: unknown): UpsertGameCodeRequest {
  if (isByteLikeBody(body)) {
    return normalizePayload(Buffer.from(body as ArrayBufferView).toString("utf8"));
  }

  if (typeof body === "string") {
    const trimmed = body.trim();

    if (!trimmed) {
      return {};
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (isRecord(parsed)) {
        return parsed as UpsertGameCodeRequest;
      }
    } catch {
      const formPayload = parseUrlEncodedPayload(trimmed);
      if (formPayload) {
        return formPayload;
      }

      return { code: trimmed };
    }

    return { code: trimmed };
  }

  return isRecord(body) ? body as UpsertGameCodeRequest : {};
}

function normalizeCodeEntries(payload: UpsertGameCodeRequest) {
  const entries: Array<{ content: string; path: string }> = [];
  const directCode = firstNonEmptyString(
    payload.code,
    payload.gameCode,
    payload.pastedCode,
    payload.html,
    payload.content,
    payload.source,
    payload.text
  );

  if (directCode) {
    entries.push({ content: directCode, path: inferPathForContent(directCode, "index.html") });
  }

  for (const file of payload.files ?? []) {
    const content = firstNonEmptyString(file.content, file.code, file.html, file.text, file.data);
    if (!content) {
      continue;
    }

    entries.push({
      content,
      path: firstNonEmptyString(file.path, file.name) ?? inferPathForContent(content, `file-${entries.length + 1}.txt`)
    });
  }

  if (entries.length === 0) {
    const fallback = findCodeLikeString(payload);
    if (fallback) {
      entries.push({ content: fallback, path: inferPathForContent(fallback, "index.html") });
    }
  }

  return entries;
}

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function findCodeLikeString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return looksLikeCode(trimmed) ? trimmed : undefined;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findCodeLikeString(entry);
      if (found) return found;
    }
    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  for (const entry of Object.values(value)) {
    const found = findCodeLikeString(entry);
    if (found) return found;
  }

  return undefined;
}

function looksLikeCode(value: string) {
  return (
    value.length > 40 &&
    /<\/?(html|script|style|canvas|body)\b|function\s+\w+|const\s+\w+\s*=|import\s+.+from\s+["']/.test(value)
  );
}

function inferPathForContent(content: string, fallback: string) {
  if (/^\s*</.test(content) || /<\/html>|<script\b|<canvas\b/i.test(content)) {
    return "index.html";
  }

  if (/\bfunction\b|\bconst\b|\blet\b|\bimport\b/.test(content)) {
    return "index.js";
  }

  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isByteLikeBody(value: unknown): value is ArrayBufferView {
  return ArrayBuffer.isView(value);
}

function parseUrlEncodedPayload(value: string): UpsertGameCodeRequest | undefined {
  if (!value.includes("=")) {
    return undefined;
  }

  try {
    const params = new URLSearchParams(value);
    const payload: UpsertGameCodeRequest = {};
    for (const [key, paramValue] of params.entries()) {
      (payload as Record<string, string>)[key] = paramValue;
    }
    return payload;
  } catch {
    return undefined;
  }
}

function chunkCode(path: string, content: string) {
  const chunks: Array<{ index: number; path: string; text: string }> = [];
  let start = 0;
  let index = 0;

  while (start < content.length) {
    const end = Math.min(start + MAX_CHUNK_LENGTH, content.length);
    const text = content.slice(start, end).trim();

    if (text) {
      chunks.push({ index, path, text });
      index += 1;
    }

    start = end;
  }

  return chunks;
}

async function embedTexts(texts: string[], apiKey: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${EMBEDDING_MODEL}:batchEmbedContents?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          content: { parts: [{ text }] },
          model: EMBEDDING_MODEL
        }))
      })
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini embedding failed: ${detail}`);
  }

  const data = await response.json() as { embeddings?: Array<{ values?: number[] }> };
  const embeddings = data.embeddings?.map((embedding) => embedding.values ?? []) ?? [];

  if (embeddings.length !== texts.length || embeddings.some((embedding) => embedding.length === 0)) {
    throw new Error("Gemini embedding response was incomplete.");
  }

  return embeddings;
}

async function upsertPineconeVectors(
  host: string,
  apiKey: string,
  namespace: string,
  vectors: Array<{ id: string; metadata: Record<string, string>; values: number[] }>
) {
  const response = await fetch(`${host.replace(/\/$/, "")}/vectors/upsert`, {
    method: "POST",
    headers: {
      "Api-Key": apiKey,
      "Content-Type": "application/json",
      "X-Pinecone-API-Version": "2025-01"
    },
    body: JSON.stringify({ namespace, vectors })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Pinecone upsert failed: ${detail}`);
  }
}

function getPineconeHost() {
  const value =
    process.env.PINECONE_INDEX_HOST?.trim() ||
    process.env.PINECONE_HOST?.trim() ||
    process.env.PINECONE_INDEX_URL?.trim();

  if (!value) {
    return "";
  }

  return value.startsWith("http") ? value : `https://${value}`;
}

function sanitizeNamespace(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64) || "dream-studio-games";
}
