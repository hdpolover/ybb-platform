export function buildApiUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

  return `${baseUrl}${path}`;
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("access_token");
}

export async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(payload.message)) {
      return payload.message.join(", ");
    }
    if (typeof payload.message === "string") {
      return payload.message;
    }
  } catch {
    // Fall through to generic message.
  }

  return `Request failed with status ${response.status}.`;
}

/**
 * Parse a NestJS response and unwrap the global TransformInterceptor envelope
 * (`{ statusCode, message, data, meta? }`). Returns the inner `data` if
 * present, otherwise the raw payload. Matches the behavior of
 * `src/shared/api-client.ts::request()` so callers don't need to know the
 * envelope shape.
 */
export async function readJsonData<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as unknown;
  if (payload && typeof payload === "object" && "data" in (payload as Record<string, unknown>)) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}