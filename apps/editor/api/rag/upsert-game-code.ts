import type { VercelRequest, VercelResponse } from "@vercel/node";

type UpsertFile = {
  content?: string;
  path?: string;
};

type UpsertGameCodeRequest = {
  code?: string;
  files?: UpsertFile[];
  gameId?: string;
  projectId?: string;
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
    const payload = (req.body ?? {}) as UpsertGameCodeRequest;
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

function normalizeCodeEntries(payload: UpsertGameCodeRequest) {
  const entries: Array<{ content: string; path: string }> = [];

  if (typeof payload.code === "string" && payload.code.trim()) {
    entries.push({ content: payload.code, path: "index.html" });
  }

  for (const file of payload.files ?? []) {
    if (typeof file.content !== "string" || !file.content.trim()) {
      continue;
    }

    entries.push({
      content: file.content,
      path: typeof file.path === "string" && file.path.trim() ? file.path.trim() : `file-${entries.length + 1}.txt`
    });
  }

  return entries;
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
