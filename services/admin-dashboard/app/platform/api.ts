export type PlatformBrand = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  websiteUrl?: string | null;
  primaryColor?: string | null;
  isActive: boolean;
  programCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PlatformProgram = {
  id: string;
  brandId: string;
  brandName?: string | null;
  name: string;
  slug: string;
  description: string | null;
  year: number;
  startDate: string;
  endDate: string;
  applicationDeadline: string;
  location: string | null;
  capacity: number | null;
  registrationOpenDate?: string | null;
  registrationCloseDate?: string | null;
  registrationFee?: number | null;
  isPublished: boolean;
  isActive: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type ProgramListResponse = {
  data: PlatformProgram[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type ApiEnvelope<T, TMeta = undefined> = {
  statusCode: number;
  message: string;
  data: T;
  meta?: TMeta;
};

type MutationEnvelope<T> = {
  message: string;
  data: T;
};

type ProgramListMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

function buildApiUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

  return `${baseUrl}${path}`;
}

function getAccessToken(): string {
  if (typeof window === "undefined") {
    throw new Error("Authentication is only available in the browser.");
  }

  const token = window.localStorage.getItem("access_token");
  if (!token) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  return token;
}

async function readErrorMessage(response: Response): Promise<string> {
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

async function request<T>(
  path: string,
  init?: RequestInit,
  options?: { unwrapData?: boolean },
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${getAccessToken()}`);

  if (!(init?.body instanceof FormData) && init?.method && init.method !== "GET" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json()) as ApiEnvelope<unknown> | T;

  if (options?.unwrapData === false) {
    return payload as T;
  }

  if (payload && typeof payload === "object" && "data" in (payload as ApiEnvelope<unknown>)) {
    return (payload as ApiEnvelope<T>).data;
  }

  return payload as T;
}

export function listPlatformBrands(): Promise<PlatformBrand[]> {
  return request<PlatformBrand[]>("/brands");
}

export function createPlatformBrand(input: {
  name: string;
  slug: string;
  description?: string;
}): Promise<PlatformBrand> {
  const formData = new FormData();
  formData.set("name", input.name);
  formData.set("slug", input.slug);
  if (input.description) {
    formData.set("description", input.description);
  }

  return request<PlatformBrand>("/brands", {
    method: "POST",
    body: formData,
  });
}

export function updatePlatformBrand(
  brandId: string,
  input: {
    name: string;
    slug: string;
    description?: string;
  },
): Promise<PlatformBrand> {
  const formData = new FormData();
  formData.set("name", input.name);
  formData.set("slug", input.slug);
  if (input.description) {
    formData.set("description", input.description);
  }

  return request<PlatformBrand>(`/brands/${brandId}`, {
    method: "PUT",
    body: formData,
  });
}

export function deletePlatformBrand(brandId: string): Promise<void> {
  return request<void>(`/brands/${brandId}`, {
    method: "DELETE",
  });
}

export function listPlatformPrograms(params?: {
  page?: number;
  limit?: number;
  brandId?: string;
  status?: string;
}): Promise<ProgramListResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(params?.page ?? 1));
  searchParams.set("limit", String(params?.limit ?? 100));

  if (params?.brandId) {
    searchParams.set("brandId", params.brandId);
  }

  if (params?.status) {
    searchParams.set("status", params.status);
  }

  return request<ApiEnvelope<PlatformProgram[], ProgramListMeta>>(
    `/programs?${searchParams.toString()}`,
    undefined,
    { unwrapData: false },
  ).then((payload) => ({
    data: payload.data,
    total: payload.meta?.total ?? payload.data.length,
    page: payload.meta?.page ?? 1,
    limit: payload.meta?.limit ?? payload.data.length,
    totalPages: payload.meta?.totalPages ?? 1,
  }));
}

export function createPlatformProgram(input: {
  brandId: string;
  name: string;
  slug: string;
  description?: string;
  year: number;
  startDate: string;
  endDate: string;
  applicationDeadline: string;
  status?: string;
  isPublished?: boolean;
  isActive?: boolean;
}): Promise<PlatformProgram> {
  return request<MutationEnvelope<PlatformProgram>>(
    "/programs",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    { unwrapData: true },
  ).then((payload) => payload.data);
}

export function updatePlatformProgram(
  programId: string,
  input: {
    brandId: string;
    name: string;
    slug: string;
    description?: string;
    year: number;
    startDate: string;
    endDate: string;
    applicationDeadline: string;
    status?: string;
    isPublished?: boolean;
    isActive?: boolean;
  },
): Promise<PlatformProgram> {
  return request<MutationEnvelope<PlatformProgram>>(
    `/programs/${programId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
    { unwrapData: true },
  ).then((payload) => payload.data);
}

export function deletePlatformProgram(programId: string): Promise<void> {
  return request<void>(`/programs/${programId}`, {
    method: "DELETE",
  });
}

// ─── Ambassador Types ─────────────────────────────────────────────────────────

export type AmbassadorRow = {
  id: string;
  fullName: string;
  referralCode: string;
  totalReferrals: number;
  successfulReferrals: number;
  isActive: boolean;
  createdAt: string;
  activatedAt?: string | null;
  deactivatedAt?: string | null;
  programId?: string;
  programName?: string;
  // nested from include
  user?: { email: string } | null;
  program?: { name: string; slug: string } | null;
};

export type AmbassadorReferral = {
  id: string;
  status: string;
  createdAt: string;
  registeredAt?: string | null;
  appliedAt?: string | null;
  acceptedAt?: string | null;
  completedAt?: string | null;
  daysToRegister?: number | null;
  daysToApply?: number | null;
  daysToAccept?: number | null;
  totalConversionDays?: number | null;
  participant?: {
    fullName?: string | null;
    user?: { email: string } | null;
  } | null;
};

export type AmbassadorListMeta = {
  total: number;
  page: number;
  limit: number;
  lastPage: number;
};

export type AmbassadorListResponse = {
  data: AmbassadorRow[];
  meta: AmbassadorListMeta;
};

export type AmbassadorReferralsResponse = {
  data: AmbassadorReferral[];
  meta: AmbassadorListMeta;
};

// ─── Ambassador API Functions ─────────────────────────────────────────────────

export function listAmbassadors(params?: {
  programId?: string;
  search?: string;
  page?: number;
}): Promise<AmbassadorListResponse> {
  const qs = new URLSearchParams();
  if (params?.programId) qs.set("programId", params.programId);
  if (params?.search) qs.set("search", params.search);
  if (params?.page) qs.set("page", String(params.page));
  return request<AmbassadorListResponse>(`/admin/ambassadors?${qs.toString()}`, undefined, { unwrapData: false });
}

export function activateAmbassador(id: string): Promise<void> {
  return request<void>(`/admin/ambassadors/${id}/activate`, { method: "PATCH" });
}

export function deactivateAmbassador(id: string): Promise<void> {
  return request<void>(`/admin/ambassadors/${id}/deactivate`, { method: "PATCH" });
}

export function deleteAmbassador(id: string): Promise<void> {
  return request<void>(`/admin/ambassadors/${id}`, { method: "DELETE" });
}

export function getAmbassadorReferrals(id: string, page = 1): Promise<AmbassadorReferralsResponse> {
  return request<AmbassadorReferralsResponse>(`/admin/ambassadors/${id}/referrals?page=${page}`, undefined, { unwrapData: false });
}
