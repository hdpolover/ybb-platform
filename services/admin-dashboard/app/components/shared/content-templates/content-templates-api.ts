// services/admin-dashboard/app/components/shared/content-templates/content-templates-api.ts
import {
  buildApiUrl,
  getAccessToken,
  readErrorMessage,
  readJsonData,
} from "@/app/components/submissionsMasterData/api";

export type ContentTemplateSummary = {
  id: string;
  name: string;
  description: string | null;
  entityType: string;
  isDefault: boolean;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ContentTemplateDetail = ContentTemplateSummary & {
  payload: { entityType: string; payloadVersion: number; items: Record<string, unknown>[] };
};

/**
 * Thrown by every function in this module on a non-2xx response. Carries the
 * HTTP status (so callers can distinguish e.g. 403 from a generic failure —
 * this API has no distinct 403 pattern of its own yet, unlike ApiError in
 * src/shared/api-client.ts, so the raw status is the way to check it here
 * too) and, when the server includes one, its machine-readable error code
 * (e.g. 'empty_template_payload', 'empty_replace_source' from
 * content-template.handler.ts / copy-scoped-rows.ts) so callers can branch
 * on the code instead of pattern-matching English copy.
 *
 * The API's global HttpExceptionFilter accepts either `errorCode` or `code`
 * on the thrown body and always emits it as top-level `errorCode`, so these
 * codes do reach the client. This reader accepts both spellings anyway, so it
 * stays correct regardless of which one a future throw site uses.
 */
export class ContentTemplateApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ContentTemplateApiError";
    this.status = status;
    this.code = code;
  }
}

function authHeaders(): { Authorization: string } {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Not authenticated");
  }
  return { Authorization: `Bearer ${token}` };
}

async function readErrorCode(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { code?: unknown; errorCode?: unknown };
    if (typeof body.code === "string") return body.code;
    if (typeof body.errorCode === "string") return body.errorCode;
  } catch {
    // Body isn't JSON, or was already consumed — no code available.
  }
  return undefined;
}

async function throwApiError(response: Response): Promise<never> {
  // Read the body twice via clone(): once through the shared readErrorMessage
  // helper (for the human-readable message, unchanged behavior including its
  // 401 redirect), once locally for the machine-readable code.
  const [message, code] = await Promise.all([
    readErrorMessage(response.clone()),
    readErrorCode(response.clone()),
  ]);
  throw new ContentTemplateApiError(message, response.status, code);
}

async function jsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    await throwApiError(response);
  }
  return readJsonData<T>(response);
}

/** Lists content templates, optionally filtered to one entity key (e.g. 'faqs'). */
export async function fetchContentTemplates(entityType?: string): Promise<ContentTemplateSummary[]> {
  const qs = entityType ? `?entityType=${encodeURIComponent(entityType)}` : "";
  const response = await fetch(buildApiUrl(`/content-templates${qs}`), { headers: authHeaders() });
  return jsonOrThrow<ContentTemplateSummary[]>(response);
}

/** Gets a single content template, including its full payload. */
export async function fetchContentTemplateDetail(id: string): Promise<ContentTemplateDetail> {
  const response = await fetch(buildApiUrl(`/content-templates/${encodeURIComponent(id)}`), { headers: authHeaders() });
  return jsonOrThrow<ContentTemplateDetail>(response);
}

/**
 * Creates a template by exporting `programId`'s current content for `entityType`
 * (optionally a subset via `itemIds`). The server derives the payload —
 * this never sends one.
 */
export async function createContentTemplateFromProgram(input: {
  entityType: string;
  programId: string;
  itemIds?: string[];
  name: string;
  description?: string;
  isDefault?: boolean;
}): Promise<ContentTemplateDetail> {
  const response = await fetch(buildApiUrl("/content-templates"), {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow<ContentTemplateDetail>(response);
}

/** Updates name/description/isDefault only — the payload is immutable after creation. */
export async function updateContentTemplate(
  id: string,
  input: { name?: string; description?: string; isDefault?: boolean },
): Promise<ContentTemplateSummary> {
  const response = await fetch(buildApiUrl(`/content-templates/${encodeURIComponent(id)}`), {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow<ContentTemplateSummary>(response);
}

/** Soft-deletes a content template. Excluded from every list/detail read afterward. */
export async function deleteContentTemplate(id: string): Promise<void> {
  const response = await fetch(buildApiUrl(`/content-templates/${encodeURIComponent(id)}`), {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) {
    await throwApiError(response);
  }
}
