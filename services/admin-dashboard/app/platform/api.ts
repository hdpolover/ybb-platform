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

export type PlatformBrandDetail = PlatformBrand & {
  about?: string | null;
  vision?: string | null;
  mission?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactWhatsapp?: string | null;
  contactAddress?: string | null;
  socialMediaLinks?: Record<string, string> | null;
  defaultLocation?: string | null;
  defaultCountry?: string | null;
  defaultTimezone?: string | null;
  requireEmailVerification?: boolean;
  defaultCurrency?: string;
  enableMultiCurrency?: boolean;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;
  settings?: {
    isMaintenanceMode: boolean;
    maintenanceMessage?: string | null;
    usdInIdr: number;
    googleAnalyticsId?: string | null;
    pixelId?: string | null;
    supportEmail?: string | null;
  } | null;
};

export function listPlatformBrands(): Promise<PlatformBrand[]> {
  return request<PlatformBrand[]>("/brands");
}

export function getPlatformBrand(brandId: string): Promise<PlatformBrandDetail> {
  return request<PlatformBrandDetail>(`/brands/${brandId}`);
}

export function updatePlatformBrandIdentity(
  brandId: string,
  input: {
    name: string;
    slug: string;
    description?: string;
    websiteUrl?: string;
    primaryColor?: string;
    contactEmail?: string;
    isActive?: boolean;
    logo?: File | null;
    banner?: File | null;
  },
): Promise<PlatformBrandDetail> {
  const formData = new FormData();
  formData.set("name", input.name);
  formData.set("slug", input.slug);
  if (input.description != null) formData.set("description", input.description);
  if (input.websiteUrl != null) formData.set("websiteUrl", input.websiteUrl);
  if (input.primaryColor != null) formData.set("primaryColor", input.primaryColor);
  if (input.contactEmail != null) formData.set("contactEmail", input.contactEmail);
  if (input.isActive != null) formData.set("isActive", String(input.isActive));
  if (input.logo) formData.set("logo", input.logo);
  if (input.banner) formData.set("banner", input.banner);
  return request<PlatformBrandDetail>(`/brands/${brandId}`, { method: "PUT", body: formData });
}

export function updatePlatformBrandDetails(
  brandId: string,
  input: {
    about?: string;
    vision?: string;
    mission?: string;
    contactPhone?: string;
    contactWhatsapp?: string;
    contactAddress?: string;
    socialMediaLinks?: Record<string, string>;
    defaultLocation?: string;
    defaultCountry?: string;
    defaultTimezone?: string;
    requireEmailVerification?: boolean;
    metaTitle?: string;
    metaDescription?: string;
    metaKeywords?: string;
  },
): Promise<PlatformBrandDetail> {
  const formData = new FormData();
  if (input.about != null) formData.set("about", input.about);
  if (input.vision != null) formData.set("vision", input.vision);
  if (input.mission != null) formData.set("mission", input.mission);
  if (input.contactPhone != null) formData.set("contactPhone", input.contactPhone);
  if (input.contactWhatsapp != null) formData.set("contactWhatsapp", input.contactWhatsapp);
  if (input.contactAddress != null) formData.set("contactAddress", input.contactAddress);
  if (input.socialMediaLinks != null)
    formData.set("socialMediaLinks", JSON.stringify(input.socialMediaLinks));
  if (input.defaultLocation != null) formData.set("defaultLocation", input.defaultLocation);
  if (input.defaultCountry != null) formData.set("defaultCountry", input.defaultCountry);
  if (input.defaultTimezone != null) formData.set("defaultTimezone", input.defaultTimezone);
  if (input.requireEmailVerification != null) formData.set("requireEmailVerification", String(input.requireEmailVerification));
  if (input.metaTitle != null) formData.set("metaTitle", input.metaTitle);
  if (input.metaDescription != null) formData.set("metaDescription", input.metaDescription);
  if (input.metaKeywords != null) formData.set("metaKeywords", input.metaKeywords);
  return request<PlatformBrandDetail>(`/brands/${brandId}/details`, { method: "PUT", body: formData });
}

export function updatePlatformBrandSettings(
  brandId: string,
  input: {
    requireEmailVerification?: boolean;
    defaultCurrency?: string;
    enableMultiCurrency?: boolean;
    isMaintenanceMode?: boolean;
    maintenanceMessage?: string;
    usdInIdr?: number;
    googleAnalyticsId?: string;
    pixelId?: string;
    supportEmail?: string;
  },
): Promise<PlatformBrandDetail> {
  return request<PlatformBrandDetail>(`/brands/${brandId}/settings`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
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

export type BrandSponsor = {
  id: string;
  name: string;
  type: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  tier: string | null;
  order: number;
};

export function listBrandSponsors(brandId: string): Promise<BrandSponsor[]> {
  return request<BrandSponsor[]>(`/brands/${brandId}/sponsors`);
}

// ─── Brand Admins ─────────────────────────────────────────────────────────────

export type BrandAdmin = {
  id: string;
  adminId: string;
  brandId: string;
  roleInBrand: string | null;
  permissions: unknown;
  assignedAt: string;
  admin?: {
    id: string;
    fullName: string;
    user?: { email: string } | null;
  };
};

export function listBrandAdmins(brandId: string): Promise<BrandAdmin[]> {
  return request<BrandAdmin[]>(`/brands/${brandId}/admins`);
}

export type AdminOption = { id: string; fullName: string; email: string };

export function listAllAdmins(search?: string): Promise<{ data: AdminOption[] }> {
  const qs = new URLSearchParams({ limit: "100", page: "1" });
  if (search) qs.set("search", search);
  return request<{ data: AdminOption[] }>(`/admins?${qs.toString()}`);
}

export function assignBrandAdmin(
  brandId: string,
  input: { adminId: string; roleInBrand?: string; permissions?: string[] }
): Promise<BrandAdmin> {
  return request<BrandAdmin>(`/brands/${brandId}/admins`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function removeBrandAdmin(brandId: string, adminId: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/brands/${brandId}/admins/${adminId}`, {
    method: "DELETE",
  });
}

// ─── Email Templates ──────────────────────────────────────────────────────────

export type EmailTemplate = {
  id: string;
  brandId: string | null;
  programId: string | null;
  name: string;
  type: string;
  subject: string;
  body: string;
  variables: unknown;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export function listEmailTemplates(params?: {
  brandId?: string;
  programId?: string;
  type?: string;
  isActive?: boolean;
}): Promise<EmailTemplate[]> {
  const qs = new URLSearchParams();
  if (params?.brandId) qs.set("brandId", params.brandId);
  if (params?.programId) qs.set("programId", params.programId);
  if (params?.type) qs.set("type", params.type);
  if (params?.isActive !== undefined) qs.set("isActive", String(params.isActive));
  const q = qs.toString();
  return request<EmailTemplate[]>(`/admin/email-templates${q ? `?${q}` : ""}`);
}

export function createEmailTemplate(input: {
  name: string;
  type: string;
  subject: string;
  body: string;
  variables?: string[];
  brandId?: string;
  programId?: string;
  isActive?: boolean;
}): Promise<EmailTemplate> {
  return request<EmailTemplate>("/admin/email-templates", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateEmailTemplate(
  id: string,
  input: Partial<{
    name: string;
    type: string;
    subject: string;
    body: string;
    variables: string[];
    isActive: boolean;
  }>
): Promise<EmailTemplate> {
  return request<EmailTemplate>(`/admin/email-templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteEmailTemplate(id: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/admin/email-templates/${id}`, { method: "DELETE" });
}

// ─── Legal Documents ──────────────────────────────────────────────────────────

export type LegalDocument = {
  id: string;
  brandId: string;
  title: string;
  slug: string;
  content: string;
  version: string;
  description: string | null;
  isRequired: boolean;
  isActive: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function listLegalDocuments(brandSlug: string): Promise<LegalDocument[]> {
  return request<LegalDocument[]>(`/brands/${brandSlug}/legal-documents/admin`);
}

export function createLegalDocument(
  brandSlug: string,
  input: { title: string; slug: string; content: string; version?: string; description?: string; isRequired?: boolean; isActive?: boolean }
): Promise<LegalDocument> {
  return request<LegalDocument>(`/brands/${brandSlug}/legal-documents`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateLegalDocument(
  brandSlug: string,
  id: string,
  input: Partial<{ title: string; slug: string; content: string; version: string; description: string; isRequired: boolean; isActive: boolean }>
): Promise<LegalDocument> {
  return request<LegalDocument>(`/brands/${brandSlug}/legal-documents/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteLegalDocument(brandSlug: string, id: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/brands/${brandSlug}/legal-documents/${id}`, {
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
