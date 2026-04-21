export async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(input, {
      headers: { "Content-Type": "application/json" },
      ...init
    });
  } catch {
    throw new Error("Network request failed. Backend may not be available.");
  }

  if (!response.ok) {
    let errorMessage = `Request failed with ${response.status}.`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) errorMessage = payload.error;
    } catch {
      // Response wasn't JSON (e.g. HTML 404 page from static hosting)
    }
    throw new Error(errorMessage);
  }

  return (await response.json()) as T;
}
