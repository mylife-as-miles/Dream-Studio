export async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(input, {
      headers: { "Content-Type": "application/json" },
      ...init
    });
  } catch {
    // Network error (e.g. no backend server on static hosting)
    throw new Error("Network request failed. Backend may not be available.");
  }

  const payload = (await response.json()) as { error?: string } & T;

  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed with ${response.status}.`);
  }

  return payload as T;
}
