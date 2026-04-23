import type { VercelRequest, VercelResponse } from "@vercel/node";

const ELEVENLABS_BASE = "https://api.elevenlabs.io";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-elevenlabs-api-key");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = req.headers["x-elevenlabs-api-key"] as string | undefined;
  if (!apiKey) return res.status(401).json({ error: "No ElevenLabs API key provided." });

  const { description, durationSeconds } = req.body ?? {};
  if (!description?.trim()) return res.status(400).json({ error: "description is required." });

  try {
    const response = await fetch(`${ELEVENLABS_BASE}/v1/sound-generation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: description,
        duration_seconds: durationSeconds ?? null,
        prompt_influence: 0.3,
        output_format: "mp3_44100_128",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[elevenlabs/sfx] upstream error", response.status, errText);
      return res.status(response.status).json({ error: "ElevenLabs SFX failed.", detail: errText });
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");

    const reader = response.body?.getReader();
    if (!reader) return res.status(500).end();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    console.error("[elevenlabs/sfx] error", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}
