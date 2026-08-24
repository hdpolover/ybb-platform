import {
  buildApiUrl,
  getAccessToken,
  readErrorMessage,
  readJsonData,
} from "@/app/components/submissionsMasterData/api";

// -------- Types (mirror API DTOs) --------

export type SystemFormField = {
  id: string;
  key: string;
  label: string;
  category: string;
  type: string;
  defaultOptions: Array<{ label: string; value: string }>;
  helpText: string | null;
  isMagic: boolean;
  isActive: boolean;
  order: number;
};

// -------- Internal helpers --------

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

// -------- Endpoints --------

/** Fetches the system form field catalog. Optionally include soft-deleted/inactive. */
export async function fetchSystemFormFields(options?: {
  includeInactive?: boolean;
}): Promise<SystemFormField[]> {
  const qs = options?.includeInactive ? "?includeInactive=true" : "";
  const response = await fetch(buildApiUrl(`/system-form-fields${qs}`), {
    headers: authHeaders(),
  });
  return jsonOrThrow<SystemFormField[]>(response);
}

// -------- Catalog mutations (super-admin only) --------

export type CreateSystemFormFieldInput = {
  key: string;
  label: string;
  category: string;
  type: string;
  defaultOptions?: Array<{ label: string; value: string }>;
  helpText?: string;
  order?: number;
};

export type UpdateSystemFormFieldInput = Partial<Omit<CreateSystemFormFieldInput, "key">> & {
  isActive?: boolean;
};

export async function createSystemFormField(
  input: CreateSystemFormFieldInput,
): Promise<SystemFormField> {
  const response = await fetch(buildApiUrl("/system-form-fields"), {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return jsonOrThrow<SystemFormField>(response);
}

export async function updateSystemFormField(
  id: string,
  input: UpdateSystemFormFieldInput,
): Promise<SystemFormField> {
  const response = await fetch(
    buildApiUrl(`/system-form-fields/${encodeURIComponent(id)}`),
    {
      method: "PATCH",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
  return jsonOrThrow<SystemFormField>(response);
}

export async function deleteSystemFormField(id: string): Promise<void> {
  const response = await fetch(
    buildApiUrl(`/system-form-fields/${encodeURIComponent(id)}`),
    {
      method: "DELETE",
      headers: authHeaders(),
    },
  );
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}
