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

export type FormTemplateSummary = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  isDefault: boolean;
  fieldCount: number;
  updatedAt: string; // ISO timestamp
};

export type FormTemplateField = {
  id: string;
  source: "system" | "custom";
  systemFieldKey: string | null;
  name: string | null;
  label: string | null;
  type: string | null;
  section: string;
  isRequired: boolean;
  order: number;
  labelOverride: string | null;
  helpTextOverride: string | null;
};

export type FormTemplateDetail = Omit<FormTemplateSummary, "fieldCount" | "updatedAt"> & {
  fields: FormTemplateField[];
  createdAt: string;
  updatedAt: string;
};

export type ApplyTemplateResult = {
  mode: "append" | "replace";
  templateId: string;
  added: string[];
  skipped: string[];
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

/** Lists all form templates (summaries). */
export async function fetchFormTemplates(): Promise<FormTemplateSummary[]> {
  const response = await fetch(buildApiUrl("/form-templates"), {
    headers: authHeaders(),
  });
  return jsonOrThrow<FormTemplateSummary[]>(response);
}

/** Gets a single form template with its fields. */
export async function fetchFormTemplateDetail(id: string): Promise<FormTemplateDetail> {
  const response = await fetch(
    buildApiUrl(`/form-templates/${encodeURIComponent(id)}`),
    { headers: authHeaders() },
  );
  return jsonOrThrow<FormTemplateDetail>(response);
}

/**
 * Applies a form template to a program's form fields.
 *
 * - `append` (default, safe): add template fields; skip any whose key already exists.
 * - `replace`: soft-delete the program's existing fields, then insert the template.
 *   Replace mode requires `confirm: true`; the helper sets it automatically.
 */
export async function applyTemplateToProgram(
  programId: string,
  templateId: string,
  mode: "append" | "replace",
): Promise<ApplyTemplateResult> {
  const body: Record<string, unknown> = {
    templateId,
    mode,
  };
  if (mode === "replace") {
    body.confirm = true;
  }
  const response = await fetch(
    buildApiUrl(
      `/programs/${encodeURIComponent(programId)}/form-fields/apply-template`,
    ),
    {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  return jsonOrThrow<ApplyTemplateResult>(response);
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

// -------- Template mutations (super-admin only) --------

export type CreateFormTemplateFieldInput = {
  source: "system" | "custom";
  systemFieldKey?: string;
  name?: string;
  label?: string;
  type?: string;
  section?: string;
  isRequired?: boolean;
  order?: number;
};

export type CreateFormTemplateInput = {
  name: string;
  description?: string;
  category?: string;
  isDefault?: boolean;
  fields: CreateFormTemplateFieldInput[];
};

export type UpdateFormTemplateInput = Partial<Omit<CreateFormTemplateInput, "fields">> & {
  fields?: CreateFormTemplateFieldInput[];
};

export async function createFormTemplate(input: CreateFormTemplateInput): Promise<FormTemplateDetail> {
  const response = await fetch(buildApiUrl("/form-templates"), {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow<FormTemplateDetail>(response);
}

export async function updateFormTemplate(id: string, input: UpdateFormTemplateInput): Promise<FormTemplateDetail> {
  const response = await fetch(buildApiUrl(`/form-templates/${encodeURIComponent(id)}`), {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow<FormTemplateDetail>(response);
}

export async function deleteFormTemplate(id: string): Promise<void> {
  const response = await fetch(buildApiUrl(`/form-templates/${encodeURIComponent(id)}`), {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}
