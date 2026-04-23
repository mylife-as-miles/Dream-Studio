/**
 * elevenlabs-api.ts — Vite server plugin
 *
 * Proxies ElevenLabs requests so the browser never hits the API directly.
 *
 * Auth: The browser sends the API key (from Vibe Settings / localStorage) via
 * the `x-elevenlabs-api-key` request header. The server forwards it to
 * ElevenLabs as `xi-api-key`.
 *
 * Endpoints exposed by this plugin:
 *
 *  POST /api/elevenlabs/tts
 *       Body: { text: string; voiceId?: string; modelId?: string }
 *       Returns: audio/mpeg stream
 *
 *  GET  /api/elevenlabs/voices
 *       Returns: { voices: ElevenLabsVoice[] }
 *
 *  POST /api/elevenlabs/sfx
 *       Body: { description: string; durationSeconds?: number }
 *       Returns: audio/mpeg stream
 */

import type { Plugin, ViteDevServer, PreviewServer } from "vite";

const ELEVENLABS_BASE = "https://api.elevenlabs.io";

/**
 * Fetch helper that forwards the client-provided API key to ElevenLabs.
 */
async function elevenLabsFetch(
  path: string,
  init: RequestInit = {},
  clientApiKey?: string,
): Promise<Response> {
  if (!clientApiKey) {
    throw new Error(
      "No ElevenLabs API key provided. Set it in Vibe Settings.",
    );
  }

  const headers = new Headers(init.headers as HeadersInit | undefined);
  headers.set("xi-api-key", clientApiKey);

  return fetch(`${ELEVENLABS_BASE}${path}`, { ...init, headers });
}

const TTS_PATH         = "/api/elevenlabs/tts";
const VOICES_PATH      = "/api/elevenlabs/voices";
const SFX_PATH         = "/api/elevenlabs/sfx";
const VOICE_ADD_PATH   = "/api/elevenlabs/voices/add";
const VOICE_DEL_PREFIX = "/api/elevenlabs/voices/";

const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"; // "George" — a good neutral default
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";

export function createElevenLabsApiPlugin(): Plugin {
  return {
    name: "elevenlabs-api",
    configureServer(server) { registerApi(server); },
    configurePreviewServer(server) { registerApi(server); },
  };
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-elevenlabs-api-key",
};

/** Extract the client-provided API key from the request header. */
function getClientKey(req: import("node:http").IncomingMessage): string | undefined {
  const val = req.headers["x-elevenlabs-api-key"];
  return typeof val === "string" && val ? val : undefined;
}

function registerApi(
  server: Pick<ViteDevServer, "middlewares"> | Pick<PreviewServer, "middlewares">,
) {
  server.middlewares.use(async (req, res, next) => {
    const pathname = req.url?.split("?")[0];

    // Handle CORS preflight from blob: origin (generated games)
    if (req.method === "OPTIONS" && pathname?.startsWith("/api/elevenlabs/")) {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    const isVoices = pathname === VOICES_PATH || pathname?.endsWith(VOICES_PATH);
    const isTts = pathname === TTS_PATH || pathname?.endsWith(TTS_PATH);
    const isSfx = pathname === SFX_PATH || pathname?.endsWith(SFX_PATH);
    const isVoiceAdd = pathname === VOICE_ADD_PATH || pathname?.endsWith(VOICE_ADD_PATH);
    const isVoiceDel = pathname?.includes(VOICE_DEL_PREFIX) && req.method === "DELETE";

    if (isVoices && req.method === "GET") {
      await handleVoices(req, res);
      return;
    }

    if (isTts && req.method === "POST") {
      await handleTts(req, res);
      return;
    }

    if (isSfx && req.method === "POST") {
      await handleSfx(req, res);
      return;
    }

    if (isVoiceAdd && req.method === "POST") {
      await handleVoiceAdd(req, res);
      return;
    }

    if (isVoiceDel) {
      const parts = pathname!.split(VOICE_DEL_PREFIX);
      const voiceId = parts[parts.length - 1];
      await handleVoiceDelete(req, voiceId, res);
      return;
    }

    next();
  });
}

async function handleVoices(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
) {
  try {
    const response = await elevenLabsFetch("/v1/voices", { method: "GET" }, getClientKey(req));
    const data = await response.json() as unknown;
    sendJson(res, 200, data);
  } catch (err) {
    console.error("[elevenlabs-api] voices error", err);
    sendJson(res, 500, { error: "Failed to fetch voices." });
  }
}

async function handleTts(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
) {
  try {
    const body = await readJson<{ text: string; voiceId?: string; modelId?: string }>(req);

    if (!body?.text?.trim()) {
      sendJson(res, 400, { error: "text is required." });
      return;
    }

    const voiceId = body.voiceId ?? DEFAULT_VOICE_ID;
    const modelId = body.modelId ?? DEFAULT_MODEL_ID;

    const response = await elevenLabsFetch(
      `/v1/text-to-speech/${voiceId}/stream`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: body.text,
          model_id: modelId,
          output_format: "mp3_44100_128",
        }),
      },
      getClientKey(req),
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("[elevenlabs-api] TTS upstream error", response.status, errText);
      sendJson(res, response.status, { error: "ElevenLabs TTS failed.", detail: errText });
      return;
    }

    res.writeHead(200, {
      ...CORS_HEADERS,
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
      "Transfer-Encoding": "chunked",
    });

    const reader = response.body?.getReader();
    if (!reader) {
      res.end();
      return;
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    console.error("[elevenlabs-api] TTS error", err);
    sendJson(res, 500, { error: "Internal server error." });
  }
}

async function handleSfx(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
) {
  try {
    const body = await readJson<{ description: string; durationSeconds?: number }>(req);

    if (!body?.description?.trim()) {
      sendJson(res, 400, { error: "description is required." });
      return;
    }

    const response = await elevenLabsFetch("/v1/sound-generation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: body.description,
        duration_seconds: body.durationSeconds ?? null,
        prompt_influence: 0.3,
        output_format: "mp3_44100_128",
      }),
    }, getClientKey(req));

    if (!response.ok) {
      const errText = await response.text();
      console.error("[elevenlabs-api] SFX upstream error", response.status, errText);
      sendJson(res, response.status, { error: "ElevenLabs SFX failed.", detail: errText });
      return;
    }

    res.writeHead(200, {
      ...CORS_HEADERS,
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    });

    const reader = response.body?.getReader();
    if (!reader) { res.end(); return; }
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    console.error("[elevenlabs-api] SFX error", err);
    sendJson(res, 500, { error: "Internal server error." });
  }
}

async function handleVoiceAdd(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
) {
  try {
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", resolve);
      req.on("error", reject);
    });
    const rawBody = Buffer.concat(chunks);

    const response = await elevenLabsFetch("/v1/voices/add", {
      method: "POST",
      headers: {
        "Content-Type": req.headers["content-type"] ?? "multipart/form-data",
        "Content-Length": String(rawBody.byteLength),
      },
      body: rawBody as unknown as BodyInit,
    }, getClientKey(req));

    if (!response.ok) {
      const errText = await response.text();
      console.error("[elevenlabs-api] voice add error", response.status, errText);
      sendJson(res, response.status, { error: "Voice clone failed.", detail: errText });
      return;
    }

    const data = await response.json() as unknown;
    sendJson(res, 200, data);
  } catch (err) {
    console.error("[elevenlabs-api] voice add error", err);
    sendJson(res, 500, { error: "Internal server error." });
  }
}

async function handleVoiceDelete(
  req: import("node:http").IncomingMessage,
  voiceId: string,
  res: import("node:http").ServerResponse,
) {
  try {
    const response = await elevenLabsFetch(`/v1/voices/${voiceId}`, {
      method: "DELETE",
    }, getClientKey(req));

    if (!response.ok) {
      const errText = await response.text();
      sendJson(res, response.status, { error: "Voice delete failed.", detail: errText });
      return;
    }

    sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error("[elevenlabs-api] voice delete error", err);
    sendJson(res, 500, { error: "Internal server error." });
  }
}

function sendJson(res: import("node:http").ServerResponse, status: number, data: unknown) {
  const body = JSON.stringify(data);
  res.writeHead(status, { ...CORS_HEADERS, "Content-Type": "application/json" });
  res.end(body);
}

async function readJson<T>(req: import("node:http").IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString()) as T); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}
