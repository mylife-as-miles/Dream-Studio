import type {
  ArticraftMaterializeRequest,
  ArticraftMaterializeResponse
} from "@/lib/articraft-contract";

export async function materializeArticraftAsset(
  request: ArticraftMaterializeRequest,
  signal?: AbortSignal
): Promise<ArticraftMaterializeResponse> {
  const response = await fetch("/api/articraft/materialize", {
    body: JSON.stringify(request),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST",
    signal
  });
  const payload = await response.json() as ArticraftMaterializeResponse | {
    detail?: string;
    error?: string;
  };

  if (!response.ok) {
    const error = "error" in payload ? payload.error : undefined;
    const detail = "detail" in payload ? payload.detail : undefined;
    throw new Error([error, detail].filter(Boolean).join(": ") || "Articraft materialization failed.");
  }

  if (!("success" in payload) || payload.success !== true) {
    throw new Error("Articraft materialization returned an invalid response.");
  }

  return payload;
}
