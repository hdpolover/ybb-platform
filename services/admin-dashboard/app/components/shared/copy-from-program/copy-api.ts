import {
  buildApiUrl,
  getAccessToken,
  readErrorMessage,
  readJsonData,
} from "@/app/components/submissionsMasterData/api";

export type CopyPreviewItem = {
  id: string;
  label: string;
  meta?: string;
  hasExternalMedia?: boolean;
};

export type CopyResult = {
  created: number;
  skipped: number;
  replaced: number;
};

export type SourceCount = {
  programId: string;
  count: number;
};

function authHeaders(): { Authorization: string } {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Not authenticated");
  }
  return { Authorization: `Bearer ${token}` };
}

async function jsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return readJsonData<T>(response);
}

/** Counts how many items of `entityKey` each of `programIds` currently has. */
export async function fetchCopySourceCounts(
  entityKey: string,
  programIds: string[],
): Promise<SourceCount[]> {
  if (programIds.length === 0) return [];
  const qs = `?programIds=${programIds.map(encodeURIComponent).join(",")}`;
  const response = await fetch(
    buildApiUrl(`/programs/copy/${encodeURIComponent(entityKey)}/counts${qs}`),
    { headers: authHeaders() },
  );
  return jsonOrThrow<SourceCount[]>(response);
}

/** Previews the copyable items of `entityKey` on `programId` (typically a candidate source). */
export async function fetchCopyPreview(
  entityKey: string,
  programId: string,
): Promise<CopyPreviewItem[]> {
  const response = await fetch(
    buildApiUrl(`/programs/${encodeURIComponent(programId)}/copy/${encodeURIComponent(entityKey)}/preview`),
    { headers: authHeaders() },
  );
  return jsonOrThrow<CopyPreviewItem[]>(response);
}

/**
 * Copies `entityKey` from `params.sourceProgramId` into `targetProgramId`.
 * - `append` (default, safe): add selected items; skip any whose dedupe key already exists.
 * - `replace`: soft-delete the target's existing items, then insert. Requires `confirm: true`;
 *   this helper sets it automatically when mode is 'replace'.
 */
export async function postCopyEntity(
  entityKey: string,
  targetProgramId: string,
  params: { sourceProgramId: string; itemIds?: string[]; mode: "append" | "replace" },
): Promise<CopyResult> {
  const body: Record<string, unknown> = {
    sourceProgramId: params.sourceProgramId,
    mode: params.mode,
  };
  if (params.itemIds) {
    body.itemIds = params.itemIds;
  }
  if (params.mode === "replace") {
    body.confirm = true;
  }
  const response = await fetch(
    buildApiUrl(`/programs/${encodeURIComponent(targetProgramId)}/copy/${encodeURIComponent(entityKey)}`),
    {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return jsonOrThrow<CopyResult>(response);
}
