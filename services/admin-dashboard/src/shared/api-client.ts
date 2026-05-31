/**
 * Shared API client for the admin dashboard.
 *
 * Single source of truth for all API calls. Builds on the same
 * patterns as `app/platform/api.ts` (JWT Bearer, env base URL,
 * unwrap `data` envelope automatically).
 */

import { redirectToLogin } from "@/src/shared/login-redirect";
import {
  requestAdminProfileRefresh,
  shouldRefreshAdminProfileForMutation,
} from "@/src/shared/admin-profile-refresh";

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function buildApiUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  return `${baseUrl}${path}`;
}

export function getAccessToken(): string {
  if (typeof window === "undefined")
    throw new Error("Authentication is only available in the browser.");
  const token = window.localStorage.getItem("access_token");
  if (!token) {
    redirectToLogin("session_expired");
    throw new Error("Session expired. Redirecting to login...");
  }
  return token;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[]; error?: string };
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (typeof body.message === "string") return body.message;
    if (typeof body.error === "string") return body.error;
  } catch { /* fall through */ }
  return `Request failed with status ${res.status}.`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${getAccessToken()}`);

  if (
    !(init?.body instanceof FormData) &&
    init?.method &&
    init.method !== "GET" &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(buildApiUrl(path), { ...init, headers });

  if (res.status === 401) {
    redirectToLogin("session_expired");
    throw new Error("Session expired. Redirecting to login...");
  }

  if (!res.ok) throw new Error(await readErrorMessage(res));
  if (res.status === 204) {
    if (shouldRefreshAdminProfileForMutation(path, method)) {
      requestAdminProfileRefresh();
    }
    return undefined as T;
  }

  const payload = await res.json();
  // Unwrap `{ data: ... }` envelope if present
  const result =
    payload && typeof payload === "object" && "data" in payload
      ? (payload.data as T)
      : (payload as T);

  if (shouldRefreshAdminProfileForMutation(path, method)) {
    requestAdminProfileRefresh();
  }

  return result;
}

async function requestText(path: string, init?: RequestInit): Promise<string> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${getAccessToken()}`);

  const res = await fetch(buildApiUrl(path), { ...init, headers });

  if (res.status === 401) {
    redirectToLogin("session_expired");
    throw new Error("Session expired. Redirecting to login...");
  }

  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.text();
}

// ─── Pagination helper ────────────────────────────────────────────────────────

export type PaginatedMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type Paginated<T> = {
  data: T[];
  meta: PaginatedMeta;
};

// The API's TransformInterceptor wraps paginated responses as:
// { statusCode, message, data: T[], meta: { meta: PaginatedMeta } | PaginatedMeta }
// request() only returns payload.data (the array), discarding meta.
// Use requestPaginated() for any endpoint that returns { data: [], meta: {} }.
async function requestPaginated<T>(path: string, init?: RequestInit): Promise<Paginated<T>> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${getAccessToken()}`);
  if (
    !(init?.body instanceof FormData) &&
    init?.method &&
    init.method !== "GET" &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(buildApiUrl(path), { ...init, headers });
  if (res.status === 401) {
    redirectToLogin("session_expired");
    throw new Error("Session expired. Redirecting to login...");
  }
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const payload = await res.json() as {
    data?: T[];
    meta?: Record<string, unknown> & { meta?: PaginatedMeta };
  };
  const data: T[] = (payload.data ?? []) as T[];
  const rawMeta = (payload.meta ?? {}) as Record<string, unknown> & { meta?: PaginatedMeta };
  const meta = (rawMeta.meta ?? rawMeta) as PaginatedMeta;
  return { data, meta };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdminRole = {
  id: string;
  name: string;
  description?: string | null;
  permissions: string[];
  isActive: boolean;
  usersCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type Admin = {
  id: string;
  userId: string;
  fullName: string;
  roleId: string | null;
  role: AdminRole | null;
  user: {
    id: string;
    email: string;
    isActive: boolean;
    createdAt: string;
  };
  brandIds: string[];
  programIds?: string[];
  brands?: Array<{
    brandId: string;
    brandName: string;
    roleInBrand?: string | null;
    permissions: string[];
  }>;
  programs?: Array<{
    programId: string;
    programName: string;
    brandId: string;
    roleInProgram?: string | null;
    permissions: string[];
  }>;
  lastLoginAt?: string | null;
  avatarUrl?: string | null;
  accessiblePrograms?: Array<{
    programId: string;
    brandId: string;
    brandName: string;
    brandSlug: string;
    programName: string;
    programSlug: string;
    programYear: number;
    programStatus: string;
    isActive: boolean;
    startDate: string;
    endDate: string;
    logoUrl?: string | null;
    role: string | null;
    permissions: string[];
    accessType: "assigned" | "brand_scope" | "platform";
  }>;
  accessLevel: number | null;
  canManageAdmins: boolean;
  canAssignRoles: boolean;
  customPermissions?: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateAdminInput = {
  email: string;
  fullName: string;
  password: string;
  roleId?: string;
  brandIds?: string[];
  programIds?: string[];
};

export type UpdateAdminInput = {
  fullName?: string;
  roleId?: string;
  brandIds?: string[];
  programIds?: string[];
  isActive?: boolean;
};

export type CreateAdminRoleInput = {
  name: string;
  description?: string;
  permissions: string[];
};

export type UpdateAdminRoleInput = Partial<CreateAdminRoleInput>;

export type User = {
  id: string;
  email: string;
  brandId: string | null;
  isActive: boolean;
  emailVerified: boolean;
  role?: string;
  isOnboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BrandDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  websiteUrl: string | null;
  primaryColor: string | null;
  isActive: boolean;
  tagline: string | null;
  vision: string | null;
  mission: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  whatsappNumber: string | null;
  address: string | null;
  country: string | null;
  city: string | null;
  socialMedia: Record<string, string> | null;
  settings?: {
    usdInIdr: number | null;
    defaultCurrency: string | null;
    timezone: string | null;
    footerNavigation: unknown | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminAnalytics = {
  programs: {
    total: number;
    published: number;
    active: number;
    draft: number;
  };
  users: {
    total: number;
    active: number;
    new_this_month: number;
  };
  applications: {
    total: number;
    by_status: Record<string, number>;
  };
  participants: {
    total: number;
  };
  top_programs: Array<{ id: string; name: string; applicants: number }>;
};

export type ProgramDashboardAnalytics = {
  kpis: {
    registeredUsers: number;
    registrationsToday: number;
    formsStarted: number;
    submittedApplications: number;
    registeredOnly: number;
    totalAmbassadors: number;
    activeAmbassadors: number;
    referredParticipants: number;
    referredParticipantsPercent: number;
    programStatus: string;
    programStatusDate: string | null;
  };
  trend: {
    daily: Array<{ label: string; registrations: number }>;
    weekly: Array<{ label: string; registrations: number }>;
    monthly: Array<{ label: string; registrations: number }>;
  };
  gender: Array<{ name: string; value: number }>;
  age: Array<{ range: string; count: number }>;
  nationalities: Array<{ country: string; count: number }>;
  topAmbassadors: Array<{ name: string; country: string; referrals: number }>;
};

export type PlatformMetricsSnapshot = {
  raw: string;
};

export type ProgramFaq = {
  id: string;
  programId: string;
  question: string;
  answer: string;
  category: string | null;
  order: number;
  isActive: boolean;
};

export type ProgramSpeaker = {
  id: string;
  programId: string;
  name: string;
  title: string | null;
  organization: string | null;
  bio: string | null;
  photoUrl: string | null;
  email: string | null;
  linkedinUrl: string | null;
  order: number;
};

export type ProgramTestimonial = {
  id: string;
  programId: string | null;
  brandId: string | null;
  name: string;
  role: string | null;
  company: string | null;
  testimonial: string;
  category: string | null;
  type: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  avatarUrl: string | null;
  rating: number | null;
  alumniYear?: number | null;
  isFeatured: boolean | null;
  isActive: boolean;
  order: number;
};

export type ProgramTimeline = {
  id: string;
  programId: string;
  title: string;
  description: string | null;
  date: string;
  endDate: string | null;
  order: number;
  type: string;
  isActive: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function pickTimelineDate(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

function normalizeProgramTimeline(raw: unknown): ProgramTimeline {
  const source = asRecord(raw);
  return {
    id: asString(source.id),
    programId: asString(source.programId ?? source.program_id),
    title: asString(source.title),
    description:
      typeof source.description === "string" ? source.description : null,
    date: pickTimelineDate(source, ["date", "startDate", "start_date"]),
    endDate: pickTimelineDate(source, ["endDate", "end_date"]) || null,
    order: asNumber(source.order),
    type: asString(source.type, "custom"),
    isActive: asBoolean(source.isActive ?? source.is_active, true),
  };
}

export type ProgramSchedule = {
  id: string;
  programId: string;
  day: string;
  activity: string;
  description: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  speaker: string | null;
  order: number;
  isActive: boolean;
};

export type ProgramGalleryItem = {
  id: string;
  programId: string;
  imageUrl: string;
  title: string | null;
  description: string | null;
  year: number | null;
  order: number;
  isActive: boolean;
};

// Mirrors the Go PaymentMethodEntity on the payment service (snake_case keys
// over the wire). Keep field names in sync with
// services/payment/internal/domain/entities/payment_method.go.
export type PaymentMethodType = "AUTOMATIC" | "MANUAL";

export type PaymentMethodFeeConfig = {
  fixed_fee: number;
  percentage_fee: number;
  min_fee: number;
  currency: string;
  is_surcharge: boolean;
};

export type PaymentMethod = {
  id: string;
  name: string;
  code: string;
  type: PaymentMethodType;
  is_active: boolean;
  display_name: string;
  description: string;
  icon: string;
  gateway_name: string;
  gateway_type: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  instructions: string;
  requires_proof: boolean;
  admin_instructions: string;
  sort_order: number;
  config?: PaymentMethodFeeConfig;
};

/**
 * A single editable field in the admin Edit-Submission drawer.
 * Mirrors SubmissionFormFieldAdminDto from the API.
 */
export type SubmissionFormFieldAdmin = {
  /** Field machine name (key in personalData or essayAnswers). */
  name: string;
  /** Human-readable label. */
  label: string;
  /** Raw field type: 'text' | 'textarea' | 'select' | 'date' | 'file' | … */
  type: string;
  /** Which JSON blob this value should be written to on save. */
  store: "personalData" | "essayAnswers";
  /** Section the field belongs to. */
  section: string;
  isRequired: boolean;
  /** Current persisted value (always a string; objects/arrays are JSON-serialised). */
  value: string;
  /** True for file/upload fields — display only, no edit control. */
  readonly: boolean;
  options?: Array<{ label: string; value: string }>;
  order: number;
};

export type SubmissionSectionAdmin = {
  section: string;
  label: string;
  fields: SubmissionFormFieldAdmin[];
};

export type Application = {
  id: string;
  programId: string;
  participantId: string;
  status: string;
  applicationCategory: string;
  ticketStatus?: string | null;
  scoreTotal: number | null;
  scoreStatus: string | null;
  registrationPaymentStatus: string;
  programPaymentStatus: string;
  motivationLetter?: string;
  achievements?: string;
  experiences?: string;
  twibbonLink?: string;
  referralCode?: string;
  createdAt: string;
  updatedAt: string;
  participant?: {
    id: string;
    fullName: string;
    nickName?: string | null;
    email: string;
    phoneCountryCode?: string | null;
    phoneNumber?: string | null;
    birthdate?: string | null;
    gender?: string | null;
    nationality?: string | null;
    originCity?: string | null;
    originCountry?: string | null;
    originAddress?: string | null;
    currentCity?: string | null;
    currentCountry?: string | null;
    currentAddress?: string | null;
    emergencyContactPhone?: string | null;
    emergencyContactCountryCode?: string | null;
    emergencyContactRelation?: string | null;
    tshirtSize?: string | null;
    medicalConditions?: string | null;
    educationLevel?: string | null;
    institution?: string | null;
    major?: string | null;
    organizations?: string | null;
    instagramUsername?: string | null;
    linkedinUrl?: string | null;
    portfolioUrl?: string | null;
    knowledgeSource?: string | null;
    referralCode?: string | null;
    profilePictureUrl?: string | null;
    resumeUrl?: string | null;
  };
  program?: { id: string; name: string };
  /**
   * Structured submission form for the admin Edit-Submission feature.
   * Present only when the program has active form field definitions.
   */
  submissionForm?: {
    sections: SubmissionSectionAdmin[];
  };
};

export type ProgramAnnouncement = {
  id: string;
  programId: string;
  title: string;
  content: string;
  category: string | null;
  targetAudience: string;
  sendEmail: boolean;
  isPinned: boolean;
  imageUrl: string | null;
  tags: string[];
  publishDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PartnershipEnquiry = {
  id: string;
  brandId: string | null;
  programId: string | null;
  partnershipType: string;
  subCategory: string | null;
  fullName: string;
  email: string;
  whatsappNumber: string | null;
  company: string | null;
  subject: string | null;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ProgramSupportTicketStatus =
  | "open"
  | "in_progress"
  | "waiting_response"
  | "resolved"
  | "closed";

export type ProgramSupportTicketPriority = "low" | "normal" | "high" | "urgent";

export type ProgramSupportTicketAttachment = {
  fileId: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string;
  uploadedAt?: string;
};

export type ProgramSupportTicketMessage = {
  id: string;
  message: string;
  isFromAdmin: boolean;
  isInternalNote: boolean;
  senderId: string;
  senderName: string;
  createdAt: string;
  attachments: ProgramSupportTicketAttachment[];
};

export type ProgramSupportTicketSummary = {
  id: string;
  ticketNumber: string;
  category: string;
  subCategory: string | null;
  subject: string;
  status: ProgramSupportTicketStatus;
  priority: ProgramSupportTicketPriority;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  participant: {
    id: string;
    fullName: string;
    email: string;
  } | null;
};

export type ProgramSupportTicketDetail = {
  id: string;
  ticketNumber: string;
  category: string;
  subCategory: string | null;
  subject: string;
  description: string;
  status: ProgramSupportTicketStatus;
  priority: ProgramSupportTicketPriority;
  resolution: string | null;
  closedReason: string | null;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  participant: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  messages: ProgramSupportTicketMessage[];
};

// ─── Admins ───────────────────────────────────────────────────────────────────

export type SupportAccessConfig = {
  isEnabled: boolean;
  hasSecret: boolean;
  updatedAt: string | null;
  lastRotatedAt: string | null;
  updatedByAdminId: string | null;
  participantPortalOrigin: string | null;
};

export type UpdateSupportAccessConfigInput = {
  isEnabled?: boolean;
  newSecret?: string;
};

export type CreateSupportImpersonationInput = {
  participantId?: string;
  participantEmail?: string;
  programId?: string;
  supportSecret: string;
  reason: string;
};

export type CreateSupportImpersonationResponse = {
  loginUrl: string;
  expiresAt: string;
  participantEmail: string;
};

export function listAdmins(params?: {
  page?: number;
  limit?: number;
  search?: string;
  roleId?: string;
  brandId?: string;
  programId?: string;
}): Promise<Paginated<Admin>> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.search) q.set("search", params.search);
  if (params?.roleId) q.set("roleId", params.roleId);
  if (params?.brandId) q.set("brandId", params.brandId);
  if (params?.programId) q.set("programId", params.programId);
  return requestPaginated<Admin>(`/admins?${q}`);
}

export function getAdmin(id: string): Promise<Admin> {
  return request<Admin>(`/admins/${id}`);
}

export function createAdmin(input: CreateAdminInput): Promise<Admin> {
  return request<Admin>("/admins", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateAdmin(id: string, input: UpdateAdminInput): Promise<Admin> {
  return request<Admin>(`/admins/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteAdmin(id: string): Promise<void> {
  return request<void>(`/admins/${id}`, { method: "DELETE" });
}

export function resetAdminPassword(id: string, password: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/admins/${id}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export function listAdminRoles(params?: {
  programId?: string;
  search?: string;
}): Promise<AdminRole[]> {
  const q = new URLSearchParams();
  if (params?.programId) q.set("programId", params.programId);
  if (params?.search) q.set("search", params.search);
  return request<AdminRole[]>(`/admin-roles${q.size > 0 ? `?${q.toString()}` : ""}`);
}

export function createAdminRole(input: CreateAdminRoleInput): Promise<AdminRole> {
  return request<AdminRole>("/admin-roles", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateAdminRole(id: string, input: UpdateAdminRoleInput): Promise<AdminRole> {
  return request<AdminRole>(`/admin-roles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteAdminRole(id: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/admin-roles/${id}`, {
    method: "DELETE",
  });
}

export function getSupportAccessConfig(): Promise<SupportAccessConfig> {
  return request<SupportAccessConfig>("/admins/support-access/config");
}

export function updateSupportAccessConfig(
  input: UpdateSupportAccessConfigInput,
): Promise<SupportAccessConfig> {
  return request<SupportAccessConfig>("/admins/support-access/config", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function createSupportImpersonation(
  input: CreateSupportImpersonationInput,
): Promise<CreateSupportImpersonationResponse> {
  return request<CreateSupportImpersonationResponse>("/admins/support-access/impersonations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ─── Maintenance ──────────────────────────────────────────────────────────────

export function clearAllCache(): Promise<{ message: string; timestamp: string }> {
  return request<{ message: string; timestamp: string }>("/cache/clear", {
    method: "DELETE",
  });
}

export function purgeQueues(): Promise<{
  message: string;
  queues: { queue: string; purged: number }[];
  timestamp: string;
}> {
  return request("/queue/purge", { method: "DELETE" });
}

// ─── Users ────────────────────────────────────────────────────────────────────

export function listUsers(params?: {
  brandId?: string;
  role?: string;
  skip?: number;
  take?: number;
}): Promise<User[]> {
  const q = new URLSearchParams();
  if (params?.brandId) q.set("brandId", params.brandId);
  if (params?.role) q.set("role", params.role);
  if (params?.skip !== undefined) q.set("skip", String(params.skip));
  if (params?.take !== undefined) q.set("take", String(params.take));
  return request<User[]>(`/users?${q}`);
}

export function getUser(id: string, brandId?: string): Promise<User> {
  const q = brandId ? `?brandId=${brandId}` : "";
  return request<User>(`/users/${id}${q}`);
}

export function createUser(data: {
  brandId: string;
  email: string;
  password: string;
}): Promise<User> {
  return request<User>("/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function activateUser(id: string, brandId: string): Promise<User> {
  return request<User>(`/users/${id}/activate?brandId=${encodeURIComponent(brandId)}`, {
    method: 'PATCH',
  });
}

export function deactivateUser(id: string, brandId: string): Promise<User> {
  return request<User>(`/users/${id}/deactivate?brandId=${encodeURIComponent(brandId)}`, {
    method: 'PATCH',
  });
}

export function resendVerificationEmail(
  email: string,
  brandSlug: string,
): Promise<{ success: boolean; message: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) throw new Error('NEXT_PUBLIC_API_URL is not configured.');

  return fetch(`${baseUrl}/auth/resend-verification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-brand-domain': brandSlug,
    },
    body: JSON.stringify({ email }),
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        Array.isArray(body.message)
          ? body.message.join(', ')
          : body.message ?? `Request failed with status ${res.status}.`,
      );
    }
    return res.json();
  });
}

// ─── Brands / Settings ───────────────────────────────────────────────────────

export function getBrand(id: string): Promise<BrandDetail> {
  return request<BrandDetail>(`/brands/${id}`);
}

export function updateBrandDetails(
  id: string,
  input: Partial<{
    name: string;
    tagline: string;
    description: string;
    vision: string;
    mission: string;
    contactEmail: string;
    contactPhone: string;
    whatsappNumber: string;
    address: string;
    country: string;
    city: string;
    socialMedia: Record<string, string>;
  }>,
): Promise<BrandDetail> {
  const formData = new FormData();
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) {
      formData.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    }
  }
  return request<BrandDetail>(`/brands/${id}/details`, {
    method: "PUT",
    body: formData,
  });
}

export function updateBrandSettings(
  id: string,
  input: Partial<{
    usdInIdr: number;
    defaultCurrency: string;
    timezone: string;
    footerNavigation: unknown;
  }>,
): Promise<BrandDetail> {
  return request<BrandDetail>(`/brands/${id}/settings`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export function getAdminAnalytics(brandId?: string): Promise<AdminAnalytics> {
  const q = brandId ? `?brandId=${brandId}` : "";
  return request<AdminAnalytics>(`/stats/admin/analytics${q}`);
}

export async function getPlatformMetricsSnapshot(): Promise<PlatformMetricsSnapshot> {
  const raw = await requestText("/metrics");
  return { raw };
}

export function getProgramDashboardAnalytics(programId: string): Promise<ProgramDashboardAnalytics> {
  return request<ProgramDashboardAnalytics>(`/stats/admin/programs/${encodeURIComponent(programId)}/dashboard`);
}

export type ProgramAnalytics = {
  participants: {
    funnel: Array<{ stage: string; count: number; pct: number }>;
    byCategory: Array<{ category: string; count: number; pct: number }>;
    byEducation: Array<{ level: string; count: number; pct: number }>;
    topInstitutions: Array<{ name: string; count: number }>;
  };
  payments: {
    kpis: {
      totalInvoices: number;
      paidCount: number;
      processingCount: number;
      unpaidCount: number;
      failedCount: number;
      cancelledCount: number;
      totalRevenueIdr: number;
      totalRevenueUsd: number;
      conversionRate: number;
    };
    revenueByMonth: Array<{ label: string; idr: number; usd: number }>;
    byTier: Array<{ name: string; paidCount: number; totalAmount: number; currency: string }>;
    byPaymentMethod: Array<{ method: string; count: number }>;
    countriesByStatus: Array<{ country: string; paid: number; processing: number; unpaid: number; failed: number; cancelled: number; total: number }>;
  };
};

export type AnalyticsFilters = {
  dateFrom?: string;
  dateTo?: string;
  payDateFrom?: string;
  payDateTo?: string;
  appStatuses?: string[];
  appCategory?: string;
  paymentStatuses?: string[];
  currency?: string;
};

export function getProgramAnalytics(programId: string, filters?: AnalyticsFilters): Promise<ProgramAnalytics> {
  const p = new URLSearchParams();
  if (filters?.dateFrom) p.set('dateFrom', filters.dateFrom);
  if (filters?.dateTo) p.set('dateTo', filters.dateTo);
  if (filters?.payDateFrom) p.set('payDateFrom', filters.payDateFrom);
  if (filters?.payDateTo) p.set('payDateTo', filters.payDateTo);
  if (filters?.appStatuses?.length) p.set('appStatuses', filters.appStatuses.join(','));
  if (filters?.appCategory) p.set('appCategory', filters.appCategory);
  if (filters?.paymentStatuses?.length) p.set('paymentStatuses', filters.paymentStatuses.join(','));
  if (filters?.currency) p.set('currency', filters.currency);
  const qs = p.toString();
  return request<ProgramAnalytics>(
    `/stats/admin/programs/${encodeURIComponent(programId)}/analytics${qs ? `?${qs}` : ''}`,
  );
}

// ─── Program Config ───────────────────────────────────────────────────────────

export type ProgramConfig = {
  id: string;
  isActive: boolean;
  allowRegistration: boolean;
  requireEmailVerification: boolean;
  usdInIdr: number | null;
};

export function getProgramConfig(programId: string): Promise<ProgramConfig> {
  return request<ProgramConfig>(`/programs/${programId}?include=basic`);
}

export function updateProgramConfig(
  programId: string,
  input: Partial<Omit<ProgramConfig, "id" | "usdInIdr">>,
): Promise<ProgramConfig> {
  return request<ProgramConfig>(`/programs/${programId}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

// ─── Exchange Rate ────────────────────────────────────────────────────────────

export type ExchangeRate = {
  programId: string;
  usdInIdr: number | null;
  source: "program" | "unset";
  updatedAt: string;
};

export type ExchangeRateHistoryItem = {
  id: string;
  oldRate: number;
  newRate: number;
  changedBy: string;
  reason?: string;
  createdAt: string;
};

export type ExchangeRateHistory = {
  history: ExchangeRateHistoryItem[];
  total: number;
};

export function getExchangeRate(programId: string): Promise<ExchangeRate> {
  return request<ExchangeRate>(`/programs/${programId}/exchange-rate`);
}

export function updateExchangeRate(
  programId: string,
  usdInIdr: number,
  reason?: string,
): Promise<ExchangeRate> {
  return request<ExchangeRate>(`/programs/${programId}/exchange-rate`, {
    method: "PUT",
    body: JSON.stringify({ usdInIdr, reason }),
  });
}

export function getExchangeRateHistory(
  programId: string,
  page = 1,
  limit = 20,
): Promise<ExchangeRateHistory> {
  return request<ExchangeRateHistory>(
    `/programs/${programId}/exchange-rate/history?page=${page}&limit=${limit}`,
  );
}

// ─── Program Content — FAQs ──────────────────────────────────────────────────

export function listProgramFaqs(programId: string): Promise<ProgramFaq[]> {
  return request<ProgramFaq[]>(`/programs/${programId}/faqs`);
}

export function createProgramFaq(
  programId: string,
  input: { question: string; answer: string; category?: string; order?: number },
): Promise<ProgramFaq> {
  return request<ProgramFaq>(`/programs/${programId}/faqs`, {
    method: "POST",
    body: JSON.stringify({ ...input, programId }),
  });
}

export function updateProgramFaq(
  id: string,
  input: { question?: string; answer?: string; category?: string; order?: number; isActive?: boolean },
): Promise<ProgramFaq> {
  return request<ProgramFaq>(`/programs/faqs/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteProgramFaq(id: string): Promise<void> {
  return request<void>(`/programs/faqs/${id}`, { method: "DELETE" });
}

// ─── Program Content — Speakers ──────────────────────────────────────────────

export function listProgramSpeakers(programId: string): Promise<ProgramSpeaker[]> {
  return request<ProgramSpeaker[]>(`/programs/${programId}/speakers`);
}

export function createProgramSpeaker(
  programId: string,
  input: {
    name: string;
    title?: string;
    organization?: string;
    bio?: string;
    email?: string;
    linkedinUrl?: string;
    order?: number;
    photo?: File;
  },
): Promise<ProgramSpeaker> {
  const fd = new FormData();
  fd.set("programId", programId);
  fd.set("name", input.name);
  if (input.title) fd.set("title", input.title);
  if (input.organization) fd.set("organization", input.organization);
  if (input.bio) fd.set("bio", input.bio);
  if (input.email) fd.set("email", input.email);
  if (input.linkedinUrl) fd.set("linkedinUrl", input.linkedinUrl);
  if (input.order !== undefined) fd.set("order", String(input.order));
  if (input.photo) fd.set("photo", input.photo);
  return request<ProgramSpeaker>(`/programs/${programId}/speakers`, {
    method: "POST",
    body: fd,
  });
}

export function updateProgramSpeaker(
  id: string,
  input: {
    name?: string;
    title?: string;
    organization?: string;
    bio?: string;
    email?: string;
    linkedinUrl?: string;
    order?: number;
    photo?: File;
  },
): Promise<ProgramSpeaker> {
  const fd = new FormData();
  if (input.name) fd.set("name", input.name);
  if (input.title !== undefined) fd.set("title", input.title);
  if (input.organization !== undefined) fd.set("organization", input.organization);
  if (input.bio !== undefined) fd.set("bio", input.bio);
  if (input.email !== undefined) fd.set("email", input.email);
  if (input.linkedinUrl !== undefined) fd.set("linkedinUrl", input.linkedinUrl);
  if (input.order !== undefined) fd.set("order", String(input.order));
  if (input.photo) fd.set("photo", input.photo);
  return request<ProgramSpeaker>(`/programs/speakers/${id}`, {
    method: "PUT",
    body: fd,
  });
}

export function deleteProgramSpeaker(id: string): Promise<void> {
  return request<void>(`/programs/speakers/${id}`, { method: "DELETE" });
}

// ─── Program Content — Testimonials ──────────────────────────────────────────

export function listProgramTestimonials(programId: string): Promise<ProgramTestimonial[]> {
  return request<ProgramTestimonial[]>(`/programs/${programId}/testimonials`);
}

export function createProgramTestimonial(
  programId: string,
  input: {
    name: string;
    role?: string;
    company?: string;
    testimonial: string;
    avatarUrl?: string;
    type?: string;
    videoUrl?: string;
    isActive?: boolean;
    order?: number;
    brandId?: string;
    category?: string;
    alumniYear?: number | null;
  },
): Promise<ProgramTestimonial> {
  return request<ProgramTestimonial>(`/programs/${programId}/testimonials`, {
    method: "POST",
    body: JSON.stringify({ ...input, programId }),
  });
}

export function updateProgramTestimonial(
  id: string,
  input: {
    name?: string;
    role?: string;
    company?: string;
    testimonial?: string;
    avatarUrl?: string;
    type?: string;
    videoUrl?: string;
    isActive?: boolean;
    brandId?: string;
    category?: string;
    alumniYear?: number | null;
  },
): Promise<ProgramTestimonial> {
  return request<ProgramTestimonial>(`/programs/testimonials/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteProgramTestimonial(id: string): Promise<void> {
  return request<void>(`/programs/testimonials/${id}`, { method: "DELETE" });
}

// ─── Program Content — Timeline ───────────────────────────────────────────────

export function listProgramTimeline(programId: string): Promise<ProgramTimeline[]> {
  return request<unknown[]>(`/programs/${programId}/timeline`).then((items) =>
    Array.isArray(items) ? items.map((item) => normalizeProgramTimeline(item)) : [],
  );
}

export function createProgramTimelineItem(
  programId: string,
  input: { title: string; description?: string; date: string; endDate?: string; order?: number; type?: string },
): Promise<ProgramTimeline> {
  return request<unknown>(`/programs/${programId}/timeline`, {
    method: "POST",
    body: JSON.stringify({ ...input, programId }),
  }).then((item) => normalizeProgramTimeline(item));
}

export function updateProgramTimelineItem(
  id: string,
  input: Partial<ProgramTimeline>,
): Promise<ProgramTimeline> {
  return request<unknown>(`/programs/timeline/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  }).then((item) => normalizeProgramTimeline(item));
}

export function deleteProgramTimelineItem(id: string): Promise<void> {
  return request<void>(`/programs/timeline/${id}`, { method: "DELETE" });
}

// ─── Program Content — Schedule/Rundowns ─────────────────────────────────────

export function listProgramSchedules(programId: string): Promise<ProgramSchedule[]> {
  return request<ProgramSchedule[]>(`/programs/${programId}/schedules`);
}

export function createProgramSchedule(
  programId: string,
  input: {
    day: string;
    activity: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    speaker?: string;
    order?: number;
  },
): Promise<ProgramSchedule> {
  return request<ProgramSchedule>(`/programs/${programId}/schedules`, {
    method: "POST",
    body: JSON.stringify({ ...input, programId }),
  });
}

export function updateProgramSchedule(
  id: string,
  input: Partial<{
    day: string;
    activity: string;
    description: string;
    startTime: string;
    endTime: string;
    location: string;
    speaker: string;
    order: number;
    isActive: boolean;
  }>,
): Promise<ProgramSchedule> {
  return request<ProgramSchedule>(`/programs/schedules/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteProgramSchedule(id: string): Promise<void> {
  return request<void>(`/programs/schedules/${id}`, { method: "DELETE" });
}

// ─── Program Content — Gallery/Photos ────────────────────────────────────────

export function listProgramGallery(programId: string): Promise<ProgramGalleryItem[]> {
  return request<ProgramGalleryItem[]>(`/programs/${programId}/gallery`);
}

// Gallery creates/updates upload the image via the presigned flow first, then
// submit the resulting public URL as JSON. Callers pass `userId` and `brandId`
// so the upload can be scoped correctly — typically sourced from useAuth().
export async function createProgramGalleryItem(
  programId: string,
  input: {
    title?: string;
    description?: string;
    year?: number;
    order?: number;
    image?: File;
    imageUrl?: string;
    userId?: string;
    brandId?: string;
  },
): Promise<ProgramGalleryItem> {
  let imageUrl = input.imageUrl;
  if (input.image) {
    if (!input.userId || !input.brandId) {
      throw new Error("userId and brandId are required when uploading a new image.");
    }
    const upload = await uploadFileViaPresignedUrl(input.image, {
      userId: input.userId,
      brandId: input.brandId,
      bucket: "gallery",
      programId,
      assetType: "gallery",
    });
    if (!upload.publicUrl) {
      throw new Error("Upload succeeded but no public URL was returned.");
    }
    imageUrl = upload.publicUrl;
  }
  if (!imageUrl) {
    throw new Error("Either an image file or image URL is required.");
  }
  return request<ProgramGalleryItem>(`/programs/${programId}/gallery`, {
    method: "POST",
    body: JSON.stringify({
      programId,
      imageUrl,
      title: input.title,
      description: input.description,
      year: input.year,
      order: input.order,
    }),
  });
}

export async function updateProgramGalleryItem(
  id: string,
  input: Partial<Omit<ProgramGalleryItem, "id" | "programId" | "imageUrl">> & {
    image?: File;
    imageUrl?: string;
    userId?: string;
    brandId?: string;
  },
): Promise<ProgramGalleryItem> {
  let imageUrl: string | undefined = input.imageUrl;
  if (input.image) {
    if (!input.userId || !input.brandId) {
      throw new Error("userId and brandId are required when uploading a new image.");
    }
    const upload = await uploadFileViaPresignedUrl(input.image, {
      userId: input.userId,
      brandId: input.brandId,
      bucket: "gallery",
      assetType: "gallery",
    });
    if (!upload.publicUrl) {
      throw new Error("Upload succeeded but no public URL was returned.");
    }
    imageUrl = upload.publicUrl;
  }
  const { image: _image, userId: _userId, brandId: _brandId, ...rest } = input;
  void _image;
  void _userId;
  void _brandId;
  return request<ProgramGalleryItem>(`/programs/gallery/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      ...rest,
      ...(imageUrl ? { imageUrl } : {}),
    }),
  });
}

export function deleteProgramGalleryItem(id: string): Promise<void> {
  return request<void>(`/programs/gallery/${id}`, { method: "DELETE" });
}

// ─── Payment Methods ──────────────────────────────────────────────────────────

export function listPaymentMethods(): Promise<PaymentMethod[]> {
  return request<PaymentMethod[]>("/admin/payments/methods");
}

export function createPaymentMethod(input: Partial<PaymentMethod> & { name: string; code: string }): Promise<PaymentMethod> {
  const payload: Record<string, unknown> = { ...input };
  if (typeof payload.type === "string") {
    const normalized = payload.type.trim().toLowerCase();
    payload.type = normalized === "automatic" ? "automatic" : "manual";
  }
  return request<PaymentMethod>("/admin/payments/methods", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePaymentMethod(id: string, input: Partial<PaymentMethod>): Promise<PaymentMethod> {
  const payload: Record<string, unknown> = { ...input };
  if (typeof payload.type === "string") {
    const normalized = payload.type.trim().toLowerCase();
    payload.type = normalized === "automatic" ? "automatic" : "manual";
  }
  return request<PaymentMethod>(`/admin/payments/methods/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// Create/update a payment method with an optional icon file. The icon is
// uploaded via the presigned-URL flow first, then the resulting public URL is
// written to the `icon` field — matching the Go entity and the NestJS
// controller's UUID→URL resolver. Mirrors the gallery-item pattern.
export async function createPaymentMethodWithIcon(
  input: Partial<PaymentMethod> & {
    name: string;
    code: string;
    iconFile?: File;
    userId?: string;
    brandId?: string;
  },
): Promise<PaymentMethod> {
  const { iconFile, userId, brandId, ...rest } = input;
  const payload: Record<string, unknown> = { ...rest };
  if (typeof payload.type === "string") {
    const normalized = payload.type.trim().toLowerCase();
    payload.type = normalized === "automatic" ? "automatic" : "manual";
  }
  if (iconFile) {
    if (!userId || !brandId) {
      throw new Error("userId and brandId are required when uploading an icon.");
    }
    const upload = await uploadFileViaPresignedUrl(iconFile, {
      userId,
      brandId,
      bucket: "payment_methods",
      assetType: "payment-method-icon",
    });
    if (!upload.publicUrl) {
      throw new Error("Upload succeeded but no public URL was returned.");
    }
    payload.icon = upload.fileId || upload.publicUrl;
  }
  return request<PaymentMethod>("/admin/payments/methods", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updatePaymentMethodWithIcon(
  id: string,
  input: Partial<PaymentMethod> & {
    iconFile?: File;
    userId?: string;
    brandId?: string;
  },
): Promise<PaymentMethod> {
  const { iconFile, userId, brandId, ...rest } = input;
  const payload: Record<string, unknown> = { ...rest };
  if (typeof payload.type === "string") {
    const normalized = payload.type.trim().toLowerCase();
    payload.type = normalized === "automatic" ? "automatic" : "manual";
  }
  if (iconFile) {
    if (!userId || !brandId) {
      throw new Error("userId and brandId are required when uploading an icon.");
    }
    const upload = await uploadFileViaPresignedUrl(iconFile, {
      userId,
      brandId,
      bucket: "payment_methods",
      assetType: "payment-method-icon",
    });
    if (!upload.publicUrl) {
      throw new Error("Upload succeeded but no public URL was returned.");
    }
    payload.icon = upload.fileId || upload.publicUrl;
  }
  return request<PaymentMethod>(`/admin/payments/methods/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deletePaymentMethod(id: string): Promise<void> {
  return request<void>(`/admin/payments/methods/${id}`, { method: "DELETE" });
}

// ─── Payment Gateway Configs ─────────────────────────────────────────────────

export const SUPPORTED_GATEWAY_PROVIDERS = ["midtrans", "xendit", "stripe", "paypal"] as const;
export type GatewayProvider = typeof SUPPORTED_GATEWAY_PROVIDERS[number];
export type GatewayMode = "sandbox" | "production";

// Mirrors the Go GatewayConfig entity. Credential fields come back decrypted
// from the payment service — never log or persist them client-side.
export type GatewayConfig = {
  id: string;
  brand_id: string | null;
  provider: GatewayProvider;
  mode: GatewayMode;
  server_key: string;
  client_key: string;
  webhook_secret: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateGatewayConfigInput = {
  provider: GatewayProvider;
  mode?: GatewayMode;
  server_key: string;
  client_key: string;
  webhook_secret?: string;
  is_active?: boolean;
  brand_id?: string;
};

export type UpdateGatewayConfigInput = Partial<CreateGatewayConfigInput>;

export function listGatewayConfigs(): Promise<GatewayConfig[]> {
  return request<GatewayConfig[]>("/admin/payment-gateways");
}

export function getGatewayConfig(id: string): Promise<GatewayConfig> {
  return request<GatewayConfig>(`/admin/payment-gateways/${id}`);
}

export function createGatewayConfig(input: CreateGatewayConfigInput): Promise<GatewayConfig> {
  return request<GatewayConfig>("/admin/payment-gateways", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateGatewayConfig(id: string, input: UpdateGatewayConfigInput): Promise<GatewayConfig> {
  return request<GatewayConfig>(`/admin/payment-gateways/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function setGatewayActive(id: string, is_active: boolean): Promise<GatewayConfig> {
  return request<GatewayConfig>(`/admin/payment-gateways/${id}/active`, {
    method: "PATCH",
    body: JSON.stringify({ is_active }),
  });
}

export function deleteGatewayConfig(id: string): Promise<void> {
  return request<void>(`/admin/payment-gateways/${id}`, { method: "DELETE" });
}

// ─── Applications / Submissions / Participants ────────────────────────────────

export async function listApplications(params?: {
  programId?: string;
  participantId?: string;
  status?: string;
  category?: "fully_funded" | "self_funded";
  search?: string;
  country?: string;
  registrationPaymentStatus?: "unpaid" | "paid" | "processing" | "failed" | "cancelled" | "refunded";
  programPaymentStatus?: "unpaid" | "paid" | "processing" | "failed" | "cancelled" | "refunded";
  sortBy?:
    | "updatedAt"
    | "createdAt"
    | "submittedAt"
    | "participantName"
    | "country"
    | "status"
    | "registrationPaymentStatus"
    | "programPaymentStatus";
  sortOrder?: "asc" | "desc";
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
  brandId?: string;
}): Promise<{ data: Application[]; total: number }> {
  const q = new URLSearchParams();
  if (params?.programId) q.set("programId", params.programId);
  if (params?.participantId) q.set("participantId", params.participantId);
  if (params?.status) q.set("status", params.status);
  if (params?.category) q.set("category", params.category);
  if (params?.search) q.set("search", params.search);
  if (params?.country) q.set("country", params.country);
  if (params?.registrationPaymentStatus) q.set("registrationPaymentStatus", params.registrationPaymentStatus);
  if (params?.programPaymentStatus) q.set("programPaymentStatus", params.programPaymentStatus);
  if (params?.sortBy) q.set("sortBy", params.sortBy);
  if (params?.sortOrder) q.set("sortOrder", params.sortOrder);
  if (params?.startDate) q.set("startDate", params.startDate);
  if (params?.endDate) q.set("endDate", params.endDate);
  if (params?.limit !== undefined) q.set("limit", String(params.limit));
  if (params?.offset !== undefined) q.set("offset", String(params.offset));
  if (params?.brandId) q.set("brandId", params.brandId);
  const raw = await request<{ applications?: Application[]; data?: Application[]; total: number }>(`/applications?${q}`);
  return { data: raw.applications ?? raw.data ?? [], total: raw.total };
}

function extractDownloadFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const basicMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return basicMatch?.[1] ?? null;
}

export async function exportApplicationsCsv(params: {
  brandId: string;
  programId?: string;
  status?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}): Promise<void> {
  const q = new URLSearchParams();
  q.set("brandId", params.brandId);
  if (params.programId) q.set("programId", params.programId);
  if (params.status) q.set("status", params.status);
  if (params.search) q.set("search", params.search);
  if (params.startDate) q.set("startDate", params.startDate);
  if (params.endDate) q.set("endDate", params.endDate);

  const response = await fetch(buildApiUrl(`/applications/export?${q}`), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const blob = await response.blob();
  const fileName =
    extractDownloadFilename(response.headers.get("content-disposition")) ??
    `applications-${new Date().toISOString().slice(0, 10)}.csv`;

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

export function getApplication(id: string): Promise<Application> {
  return request<Application>(`/applications/${id}?includeRelations=true`);
}

export type AdminUpdateSubmissionPayload = {
  personalData?: Record<string, unknown>;
  essayAnswers?: Record<string, unknown>;
  participant?: {
    fullName?: string;
    nickName?: string;
    displayName?: string;
  };
  application?: {
    motivationLetter?: string;
    achievements?: string;
    experiences?: string;
    twibbonLink?: string;
  };
  reason: string;
};

export type AdminUpdateSubmissionResult = {
  success: boolean;
  applicationId: string;
  editHistoryId: string;
};

export function adminUpdateSubmissionData(
  id: string,
  payload: AdminUpdateSubmissionPayload,
): Promise<AdminUpdateSubmissionResult> {
  return request<AdminUpdateSubmissionResult>(
    `/applications/${id}/submission-data`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function reviewApplication(
  id: string,
  input: {
    status: string;
    reviewerNote?: string;
    reviewerId: string;
    approvalMode?: "participant" | "ambassador";
  },
): Promise<Application> {
  return request<Application>(`/applications/${id}/review`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ─── Program Announcements ────────────────────────────────────────────────────

export function listProgramAnnouncements(
  programId: string,
  params?: { page?: number; limit?: number; category?: string; targetAudience?: string },
): Promise<Paginated<ProgramAnnouncement>> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.category) q.set("category", params.category);
  if (params?.targetAudience) q.set("targetAudience", params.targetAudience);
  return requestPaginated<ProgramAnnouncement>(
    `/programs/${programId}/announcements?${q}`,
  );
}

export function getProgramAnnouncement(id: string): Promise<ProgramAnnouncement> {
  return request<ProgramAnnouncement>(`/programs/announcements/${id}`);
}

export function createProgramAnnouncement(
  programId: string,
  input: {
    title: string;
    content: string;
    category?: string;
    targetAudience?: string;
    tags?: string[];
    sendEmail?: boolean;
    isPinned?: boolean;
    imageUrl?: string;
    publishDate?: string;
    isActive?: boolean;
  },
): Promise<ProgramAnnouncement> {
  return request<ProgramAnnouncement>(`/programs/${programId}/announcements`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateProgramAnnouncement(
  id: string,
  input: {
    title?: string;
    content?: string;
    category?: string | null;
    targetAudience?: string;
    tags?: string[];
    sendEmail?: boolean;
    isPinned?: boolean;
    imageUrl?: string | null;
    publishDate?: string;
    isActive?: boolean;
  },
): Promise<ProgramAnnouncement> {
  return request<ProgramAnnouncement>(`/programs/announcements/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteProgramAnnouncement(id: string): Promise<void> {
  return request<void>(`/programs/announcements/${id}`, { method: "DELETE" });
}

// ─── Program Partnership Enquiries ─────────────────────────────────────────────

export function listProgramPartnershipEnquiries(
  programId: string,
  params?: { page?: number; limit?: number; status?: string; search?: string },
): Promise<Paginated<PartnershipEnquiry>> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.status) q.set("status", params.status);
  if (params?.search) q.set("search", params.search);
  return requestPaginated<PartnershipEnquiry>(
    `/admin/programs/${encodeURIComponent(programId)}/partnership-enquiries?${q}`,
  );
}

export function updateProgramPartnershipEnquiryStatus(
  programId: string,
  enquiryId: string,
  status: string,
): Promise<PartnershipEnquiry> {
  return request<PartnershipEnquiry>(
    `/admin/programs/${encodeURIComponent(programId)}/partnership-enquiries/${encodeURIComponent(enquiryId)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
}

// ─── Program Support Tickets ──────────────────────────────────────────────────

export function listProgramSupportTickets(
  programId: string,
  params?: {
    page?: number;
    limit?: number;
    status?: ProgramSupportTicketStatus;
    priority?: ProgramSupportTicketPriority;
    search?: string;
  },
): Promise<Paginated<ProgramSupportTicketSummary>> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.status) q.set("status", params.status);
  if (params?.priority) q.set("priority", params.priority);
  if (params?.search) q.set("search", params.search);
  return requestPaginated<ProgramSupportTicketSummary>(
    `/admin/programs/${encodeURIComponent(programId)}/support-tickets?${q}`,
  );
}

export function getProgramSupportTicket(
  programId: string,
  ticketId: string,
): Promise<ProgramSupportTicketDetail> {
  return request<ProgramSupportTicketDetail>(
    `/admin/programs/${encodeURIComponent(programId)}/support-tickets/${encodeURIComponent(ticketId)}`,
  );
}

export function replyProgramSupportTicket(
  programId: string,
  ticketId: string,
  input: {
    message: string;
    attachments?: ProgramSupportTicketAttachment[];
    isInternalNote?: boolean;
  },
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(
    `/admin/programs/${encodeURIComponent(programId)}/support-tickets/${encodeURIComponent(ticketId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function updateProgramSupportTicket(
  programId: string,
  ticketId: string,
  input: {
    status?: ProgramSupportTicketStatus;
    priority?: ProgramSupportTicketPriority;
    assignedTo?: string | null;
    resolution?: string | null;
    closedReason?: string | null;
  },
): Promise<{
  id: string;
  ticketNumber: string;
  status: ProgramSupportTicketStatus;
  priority: ProgramSupportTicketPriority;
  resolution: string | null;
  closedReason: string | null;
  assignedTo: string | null;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
}> {
  return request(
    `/admin/programs/${encodeURIComponent(programId)}/support-tickets/${encodeURIComponent(ticketId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

// ─── System Announcements ─────────────────────────────────────────────────────

export type SystemAnnouncement = {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  targetAudience: string;
  brandId: string | null;
  programId: string | null;
  priority: string;
  type: string;
  isPublished: boolean;
  publishedAt: string | null;
  isDismissible: boolean;
  showBanner: boolean;
  actionUrl: string | null;
  actionLabel: string | null;
  startDate: string | null;
  endDate: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export function getSystemAnnouncementAdmin(id: string): Promise<SystemAnnouncement> {
  return request<SystemAnnouncement>(`/system/announcements/admin/${id}`);
}

export function listSystemAnnouncements(params?: {
  page?: number;
  limit?: number;
  brandId?: string;
}): Promise<Paginated<SystemAnnouncement>> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.brandId) q.set("brandId", params.brandId);
  return requestPaginated<SystemAnnouncement>(
    `/system/announcements/admin/all?${q}`,
  );
}

export function createSystemAnnouncement(input: {
  title: string;
  content: string;
  summary?: string;
  targetAudience?: string;
  brandId?: string;
  programId?: string;
  priority?: string;
  type?: string;
  isPublished?: boolean;
  isDismissible?: boolean;
  showBanner?: boolean;
  actionUrl?: string;
  actionLabel?: string;
  startDate?: string;
  endDate?: string;
  metadata?: Record<string, unknown>;
}): Promise<SystemAnnouncement> {
  return request<SystemAnnouncement>("/system/announcements/admin", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateSystemAnnouncement(
  id: string,
  input: Partial<Parameters<typeof createSystemAnnouncement>[0]>,
): Promise<SystemAnnouncement> {
  return request<SystemAnnouncement>(`/system/announcements/admin/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteSystemAnnouncement(id: string): Promise<void> {
  return request<void>(`/system/announcements/admin/${id}`, {
    method: "DELETE",
  });
}

export function publishSystemAnnouncement(
  id: string,
  publish: boolean,
): Promise<SystemAnnouncement> {
  return request<SystemAnnouncement>(
    `/system/announcements/admin/${id}/publish?publish=${publish}`,
    { method: "POST" },
  );
}

// ─── Media Library ────────────────────────────────────────────────────────────

export type MediaFile = {
  id: string;
  original_filename: string;
  filename: string;
  content_type: string;
  size: number;
  bucket: string;
  storage_path: string;
  program_id: string | null;
  asset_type: string | null;
  url: string | null;
  download_url: string | null;
  uploaded_at: string;
  updated_at: string | null;
  title: string | null;
  alt_text: string | null;
  width: number | null;
  height: number | null;
  status: string;
};

export type PaginatedMedia = {
  files: MediaFile[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
};

export function listProgramMedia(params: {
  programId: string;
  brandId: string;
  assetType?: string;
  bucket?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedMedia> {
  const qs = new URLSearchParams({
    brand_id: params.brandId,
    ...(params.assetType && { asset_type: params.assetType }),
    ...(params.bucket && { bucket: params.bucket }),
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 50),
  });
  return request<PaginatedMedia>(
    `/admin/programs/${params.programId}/media?${qs.toString()}`,
  );
}

export function deleteProgramMediaFile(params: {
  programId: string;
  fileId: string;
  brandId: string;
}): Promise<void> {
  return request<void>(
    `/admin/programs/${params.programId}/media/${params.fileId}?brand_id=${params.brandId}`,
    { method: "DELETE" },
  );
}

export function uploadProgramMediaFile(params: {
  programId: string;
  brandId: string;
  userId: string;
  file: File;
  assetType?: string;
  bucket?: string;
}): Promise<{ file: MediaFile; url: string | null; path: string }> {
  const formData = new FormData();
  formData.append("file", params.file);
  formData.append("brand_id", params.brandId);
  formData.append("user_id", params.userId);
  if (params.assetType) formData.append("asset_type", params.assetType);
  if (params.bucket) formData.append("bucket", params.bucket ?? "gallery");

  return request<{ file: MediaFile; url: string | null; path: string }>(
    `/admin/programs/${params.programId}/media`,
    { method: "POST", body: formData },
  );
}

// ─── Presigned-URL upload flow ────────────────────────────────────────────────
// Replaces the multipart path above with direct-to-Spaces uploads. The API
// never sees file bytes — the client PUTs to a signed URL and then flips the
// reserved File row from PROCESSING to READY.
//
// Use `uploadFileViaPresignedUrl` as the one-shot entry point for most callers.
// The split helpers are exposed for tests and advanced UIs that need to own
// the steps (e.g. parallel batch uploads that share one "ready" round-trip).

export type UploadContext = {
  userId: string;
  brandId: string;
  bucket?: string;
  programId?: string;
  participantId?: string;
  assetType?: string;
  title?: string;
  altText?: string;
};

export type CreateUploadUrlResponse = {
  file_id: string;
  upload_url: string;
  storage_path: string;
  bucket: string;
  public_url: string | null;
  expires_in_seconds: number;
};

export type UploadProgress = {
  loaded: number;
  total: number;
  percent: number;
  speedBps: number;
  etaSecs: number;
};

export type UploadResult = {
  fileId: string;
  publicUrl: string | null;
  storagePath: string;
  bucket: string;
};

const SUPPORTED_DOCUMENT_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const SUPPORTED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function isSupportedUploadMime(mime: string): boolean {
  return SUPPORTED_DOCUMENT_MIMES.has(mime) || SUPPORTED_IMAGE_MIMES.has(mime);
}

/**
 * Compress an image file client-side using an offscreen Canvas before upload.
 *
 * Strategy:
 *  - GIF → returned as-is (re-encoding breaks animation)
 *  - Images already ≤ COMPRESS_THRESHOLD_BYTES → returned as-is
 *  - All other images:
 *      1. Resize longest edge to ≤ MAX_DIMENSION
 *      2. Re-encode as WebP at QUALITY (alpha-safe, best compression ratio)
 *      3. If the result is somehow *larger* than the original, return the original
 *
 * Documents (PDF/Word/Excel) are never touched — pass them in as-is.
 */
export async function compressImageFile(
  file: File,
  {
    maxDimension = 2400,
    quality = 0.85,
    thresholdBytes = 1 * 1024 * 1024, // compress any image > 1 MB
  }: { maxDimension?: number; quality?: number; thresholdBytes?: number } = {},
): Promise<File> {
  // Non-images and GIFs pass through unchanged
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  // Already small enough
  if (file.size <= thresholdBytes) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const { naturalWidth: w, naturalHeight: h } = img;
      const scale = Math.min(1, maxDimension / Math.max(w, h));
      const newW = Math.round(w * scale);
      const newH = Math.round(h * scale);

      const canvas = document.createElement("canvas");
      canvas.width = newW;
      canvas.height = newH;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }

      ctx.drawImage(img, 0, 0, newW, newH);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) { resolve(file); return; }
          // Rename to .webp so the MIME is consistent
          const baseName = file.name.replace(/\.[^.]+$/, "");
          resolve(new File([blob], `${baseName}.webp`, { type: "image/webp", lastModified: Date.now() }));
        },
        "image/webp",
        quality,
      );
    };

    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}

/**
 * Ask the gateway for a presigned PUT URL and reserve a File row in PROCESSING.
 * The server validates MIME + size before issuing the URL, so a 400/413 here
 * means the file is rejected up-front (no bytes wasted).
 */
export function requestUploadUrl(
  file: File,
  ctx: UploadContext,
): Promise<CreateUploadUrlResponse> {
  return request<CreateUploadUrlResponse>("/files/upload-url", {
    method: "POST",
    body: JSON.stringify({
      filename: file.name,
      content_type: file.type || "application/octet-stream",
      size: file.size,
      user_id: ctx.userId,
      brand_id: ctx.brandId,
      bucket: ctx.bucket ?? "documents",
      program_id: ctx.programId,
      participant_id: ctx.participantId,
      asset_type: ctx.assetType,
      title: ctx.title,
      alt_text: ctx.altText,
    }),
  });
}

/**
 * PUT the file bytes straight to object storage. Does NOT use the shared
 * `request()` helper because (a) we must not send the JWT Authorization header
 * to Spaces — the presigned URL is the auth, and (b) fetch can't observe
 * upload progress, so we need XHR.
 */
export function putFileToStorage(
  file: File,
  uploadUrl: string,
  onProgress?: (progress: UploadProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    // Smooth out the raw progress ticks so ETA doesn't jitter on every packet.
    let lastTs = Date.now();
    let lastLoaded = 0;
    let speedBps = 0;

    xhr.upload.onprogress = (e) => {
      if (!onProgress || !e.lengthComputable) return;
      const now = Date.now();
      const dt = Math.max(1, now - lastTs) / 1000;
      const dLoaded = e.loaded - lastLoaded;
      speedBps = speedBps === 0 ? dLoaded / dt : speedBps * 0.7 + (dLoaded / dt) * 0.3;
      lastTs = now;
      lastLoaded = e.loaded;
      const remaining = e.total - e.loaded;
      onProgress({
        loaded: e.loaded,
        total: e.total,
        percent: e.total === 0 ? 0 : (e.loaded / e.total) * 100,
        speedBps,
        etaSecs: speedBps > 0 ? remaining / speedBps : 0,
      });
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Storage upload failed: ${xhr.status} ${xhr.responseText}`));
    };
    xhr.onerror = () => reject(new Error("Storage upload network error"));
    xhr.onabort = () => reject(new DOMException("Upload aborted", "AbortError"));

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(file);
  });
}

/**
 * Transition a File row from PROCESSING to READY. Idempotent — safe to retry.
 */
export function markFileReady(
  fileId: string,
  brandId: string,
  actualSize?: number,
): Promise<MediaFile> {
  const qs = new URLSearchParams({ brand_id: brandId });
  if (actualSize !== undefined) qs.set("actual_size", String(actualSize));
  return request<MediaFile>(`/files/${fileId}/ready?${qs.toString()}`, {
    method: "PATCH",
  });
}

/**
 * One-shot upload that handles all three steps. Throws on any failure;
 * orphaned PROCESSING rows can be cleaned up by a background job or left to
 * the DB's TTL policy (neither exists yet — flagged as a follow-up).
 */
export async function uploadFileViaPresignedUrl(
  file: File,
  ctx: UploadContext,
  onProgress?: (progress: UploadProgress) => void,
  signal?: AbortSignal,
): Promise<UploadResult> {
  // Compress images client-side first so the declared size & bytes are already reduced
  // before we hit the server's size validation.
  const processedFile = await compressImageFile(file);

  if (!isSupportedUploadMime(processedFile.type)) {
    throw new Error(
      `Unsupported file type: ${processedFile.type || "unknown"}. Allowed: PDF, Word, Excel, JPEG/PNG/WebP/GIF.`,
    );
  }
  const url = await requestUploadUrl(processedFile, ctx);
  await putFileToStorage(processedFile, url.upload_url, onProgress, signal);
  await markFileReady(url.file_id, ctx.brandId, processedFile.size);
  return {
    fileId: url.file_id,
    publicUrl: url.public_url,
    storagePath: url.storage_path,
    bucket: url.bucket,
  };
}

export function uploadProgramAnnouncementAsset(input: {
  programId: string;
  brandId: string;
  userId: string;
  file: File;
  kind: "image" | "attachment";
  title?: string;
  altText?: string;
}): Promise<UploadResult> {
  return uploadFileViaPresignedUrl(input.file, {
    userId: input.userId,
    brandId: input.brandId,
    programId: input.programId,
    bucket: "documents",
    assetType:
      input.kind === "image"
        ? "announcement-image"
        : "announcement-attachment",
    title: input.title,
    altText: input.altText,
  });
}

// ─── Program Resources (Guidelines) ──────────────────────────────────────────

export type ProgramResource = {
  id: string;
  programId: string;
  title: string;
  description?: string;
  fileUrl: string;
  fileSize?: number;
  fileType?: string;
  type: string;
  isPublic: boolean;
  order: number;
  downloads: number;
  isActive: boolean;
};

export function listProgramResources(programId: string): Promise<ProgramResource[]> {
  return request<ProgramResource[]>(`/programs/${programId}/resources`);
}

export async function createProgramResource(
  programId: string,
  input: {
    title: string;
    description?: string;
    type: string;
    isPublic?: boolean;
    order?: number;
    file: File;
    userId: string;
    brandId: string;
  },
): Promise<ProgramResource> {
  const upload = await uploadFileViaPresignedUrl(input.file, {
    userId: input.userId,
    brandId: input.brandId,
    bucket: "resources",
    programId,
    assetType: "resource",
  });
  if (!upload.publicUrl) {
    throw new Error("Upload succeeded but no public URL was returned.");
  }
  return request<ProgramResource>(`/programs/${programId}/resources`, {
    method: "POST",
    body: JSON.stringify({
      programId,
      title: input.title,
      description: input.description,
      fileUrl: upload.publicUrl,
      fileSize: input.file.size,
      fileType: input.file.type,
      type: input.type,
      isPublic: input.isPublic ?? true,
      order: input.order ?? 0,
    }),
  });
}

export async function updateProgramResource(
  id: string,
  input: {
    title?: string;
    description?: string;
    type?: string;
    isPublic?: boolean;
    order?: number;
    isActive?: boolean;
    file?: File;
    userId?: string;
    brandId?: string;
  },
): Promise<ProgramResource> {
  let fileUrl: string | undefined;
  let fileSize: number | undefined;
  let fileType: string | undefined;
  if (input.file) {
    if (!input.userId || !input.brandId) {
      throw new Error("userId and brandId required when uploading a new file.");
    }
    const upload = await uploadFileViaPresignedUrl(input.file, {
      userId: input.userId,
      brandId: input.brandId,
      bucket: "resources",
      assetType: "resource",
    });
    if (!upload.publicUrl) {
      throw new Error("Upload succeeded but no public URL was returned.");
    }
    fileUrl = upload.publicUrl;
    fileSize = input.file.size;
    fileType = input.file.type;
  }
  const { file: _file, userId: _userId, brandId: _brandId, ...rest } = input;
  void _file; void _userId; void _brandId;
  return request<ProgramResource>(`/programs/resources/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      ...rest,
      ...(fileUrl ? { fileUrl, fileSize, fileType } : {}),
    }),
  });
}

export function deleteProgramResource(id: string): Promise<void> {
  return request<void>(`/programs/resources/${id}`, { method: "DELETE" });
}

// ─── Document Templates ───────────────────────────────────────────────────────

export type DocumentTemplatePlaceholder = {
  key: string;
  label: string;
  source: string;
};

export type DocumentTemplateLayoutConfig = {
  // File-based templates
  fileSize?: number;
  fileType?: string;
  // LOA templates
  pageSize?: string;
  margins?: { top: number; right: number; bottom: number; left: number };
  headerHtml?: string;
  footerHtml?: string;
  logoUrl?: string;
  signatureUrl?: string;
};

export type DocumentTemplate = {
  id: string;
  programId: string;
  name: string;
  type: string; // 'agreement_letter' | 'complementary_document' | 'letter_of_acceptance'
  description?: string;
  templateUrl?: string;
  htmlContent?: string;
  placeholders?: DocumentTemplatePlaceholder[];
  layoutConfig?: DocumentTemplateLayoutConfig;
  audienceType: string;
  audienceConfig: Record<string, unknown>;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export function listDocumentTemplates(
  programId: string,
  type?: string,
): Promise<DocumentTemplate[]> {
  const qs = type ? `?type=${encodeURIComponent(type)}` : '';
  return request<DocumentTemplate[]>(`/programs/${programId}/document-templates${qs}`);
}

export async function createDocumentTemplate(
  programId: string,
  input: {
    name: string;
    type: string;
    description?: string;
    audienceType?: string;
    audienceConfig?: Record<string, unknown>;
    order?: number;
    // File-based templates
    file?: File;
    userId?: string;
    brandId?: string;
    // LOA templates
    htmlContent?: string;
    placeholders?: DocumentTemplatePlaceholder[];
    layoutConfig?: DocumentTemplateLayoutConfig;
  },
): Promise<DocumentTemplate> {
  let templateUrl: string | undefined;
  let fileSize: number | undefined;
  let fileType: string | undefined;

  if (input.file) {
    if (!input.userId || !input.brandId) throw new Error('userId and brandId required when uploading a file.');
    const upload = await uploadFileViaPresignedUrl(input.file, {
      userId: input.userId,
      brandId: input.brandId,
      bucket: 'documents',
      programId,
      assetType: 'document-template',
    });
    if (!upload.publicUrl) throw new Error('Upload succeeded but no public URL was returned.');
    templateUrl = upload.publicUrl;
    fileSize = input.file.size;
    fileType = input.file.type;
  }

  return request<DocumentTemplate>(`/programs/${programId}/document-templates`, {
    method: 'POST',
    body: JSON.stringify({
      programId,
      name: input.name,
      type: input.type,
      description: input.description,
      ...(templateUrl ? { templateUrl, fileSize, fileType } : {}),
      ...(input.htmlContent !== undefined ? { htmlContent: input.htmlContent } : {}),
      ...(input.placeholders !== undefined ? { placeholders: input.placeholders } : {}),
      ...(input.layoutConfig !== undefined ? { layoutConfig: input.layoutConfig } : {}),
      audienceType: input.audienceType ?? 'all_registered',
      audienceConfig: input.audienceConfig ?? {},
      order: input.order ?? 0,
    }),
  });
}

export async function updateDocumentTemplate(
  id: string,
  input: {
    name?: string;
    type?: string;
    description?: string;
    audienceType?: string;
    audienceConfig?: Record<string, unknown>;
    order?: number;
    isActive?: boolean;
    // File-based templates
    file?: File;
    userId?: string;
    brandId?: string;
    // LOA templates
    htmlContent?: string;
    placeholders?: DocumentTemplatePlaceholder[];
    layoutConfig?: DocumentTemplateLayoutConfig;
  },
): Promise<DocumentTemplate> {
  let templateUrl: string | undefined;
  let fileSize: number | undefined;
  let fileType: string | undefined;

  if (input.file) {
    if (!input.userId || !input.brandId) {
      throw new Error('userId and brandId required when uploading a new file.');
    }
    const upload = await uploadFileViaPresignedUrl(input.file, {
      userId: input.userId,
      brandId: input.brandId,
      bucket: 'documents',
      assetType: 'document-template',
    });
    if (!upload.publicUrl) throw new Error('Upload succeeded but no public URL was returned.');
    templateUrl = upload.publicUrl;
    fileSize = input.file.size;
    fileType = input.file.type;
  }

  const { file: _f, userId: _u, brandId: _b, ...rest } = input;
  void _f; void _u; void _b;

  return request<DocumentTemplate>(`/programs/document-templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      ...rest,
      ...(templateUrl ? { templateUrl, fileSize, fileType } : {}),
    }),
  });
}

export async function generateLoa(
  programId: string,
  templateId: string,
  body: { participantId?: string; bulk?: boolean },
): Promise<{ generated: number; failed: number }> {
  return request<{ generated: number; failed: number }>(
    `/programs/${programId}/document-templates/${templateId}/generate`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export function deleteDocumentTemplate(id: string): Promise<void> {
  return request<void>(`/programs/document-templates/${id}`, { method: 'DELETE' });
}

// ─── Program Invoices ────────────────────────────────────────────────────────

export type InvoiceStatus = "unpaid" | "paid" | "processing" | "failed" | "cancelled" | "refunded";

export type InvoiceListItem = {
  id: string;
  applicationId: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  paymentMethod: string | null;
  paidAt: string | null;
  externalTransactionId: string | null;
  externalIntentId: string | null;
  pricingTier: {
    id: string;
    name: string;
    feeType: string;
    // Dual-pricing fields. Either may be null on legacy tiers that haven't
    // been backfilled yet, so always treat them as optional in UI.
    usdPrice: number | null;
    idrPrice: number | null;
  };
  application: {
    status: string;
    applicationCategory: string | null;
    ticketStatus: string | null;
  };
  participant: {
    id: string;
    fullName: string;
    userId: string;
    email: string | null;
    nationality: string | null;
    originCountry: string | null;
  };
  // Verifier audit trail — populated when an admin approves, rejects, or
  // manually overrides the invoice. Null on auto-progressed invoices.
  verifiedBy: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  followUpStatus:
    | "participant_cancelled"
    | "payment_cancelled_issue"
    | "payment_failed"
    | "manual_proof_rejected"
    | null;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceDetail = InvoiceListItem & {
  transaction: Record<string, unknown> | null;
  transactions: Array<Record<string, unknown>>;
};

export type InvoiceSummary = Record<InvoiceStatus, { count: number; amount: number }>;

export type InvoiceMetrics = {
  totalInvoices: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  collectionRate: number;
  averagePaidAmount: number;
};

export type InvoiceFilterOptions = {
  tiers: Array<{ id: string; name: string; feeType: string }>;
  paymentMethods: Array<{ value: string; label?: string; count: number }>;
  currencies: Array<{ value: string; count: number }>;
  applicationStatuses: Array<{ value: string; count: number }>;
  invoiceStatuses: Array<{ value: string; count: number }>;
  followUpStatuses: Array<{ value: string; count: number }>;
  feeTypes: Array<{ value: string; count: number }>;
};

export async function listProgramInvoices(params: {
  programId: string;
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  paymentMethod?: string;
  tierId?: string;
  feeType?: string;
  applicationStatus?: string;
  followUpStatus?:
    | "participant_cancelled"
    | "payment_cancelled_issue"
    | "payment_failed"
    | "manual_proof_rejected";
  currency?: string;
  dateFrom?: string;
  dateTo?: string;
  paidFrom?: string;
  paidTo?: string;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: "createdAt" | "paidAt" | "amount" | "updatedAt";
  sortOrder?: "asc" | "desc";
}): Promise<{
  data: InvoiceListItem[];
  meta: PaginatedMeta;
  summary: InvoiceSummary;
  overallSummary: InvoiceSummary;
  metrics: InvoiceMetrics;
  filters: InvoiceFilterOptions;
}> {
  const q = new URLSearchParams({ programId: params.programId });
  if (params.page) q.set("page", String(params.page));
  if (params.limit) q.set("limit", String(params.limit));
  if (params.status) q.set("status", params.status);
  if (params.search) q.set("search", params.search);
  if (params.paymentMethod) q.set("paymentMethod", params.paymentMethod);
  if (params.tierId) q.set("tierId", params.tierId);
  if (params.feeType) q.set("feeType", params.feeType);
  if (params.applicationStatus) q.set("applicationStatus", params.applicationStatus);
  if (params.followUpStatus) q.set("followUpStatus", params.followUpStatus);
  if (params.currency) q.set("currency", params.currency);
  if (params.dateFrom) q.set("dateFrom", params.dateFrom);
  if (params.dateTo) q.set("dateTo", params.dateTo);
  if (params.paidFrom) q.set("paidFrom", params.paidFrom);
  if (params.paidTo) q.set("paidTo", params.paidTo);
  if (typeof params.minAmount === "number") q.set("minAmount", String(params.minAmount));
  if (typeof params.maxAmount === "number") q.set("maxAmount", String(params.maxAmount));
  if (params.sortBy) q.set("sortBy", params.sortBy);
  if (params.sortOrder) q.set("sortOrder", params.sortOrder);

  // The TransformInterceptor unwraps { data: [], meta: {}, summary: {} } into
  // { statusCode, data: [], meta: { meta: {...}, summary: {...} } }
  // so we must use a raw fetch (not request()) to preserve the full structure.
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${getAccessToken()}`);
  const res = await fetch(buildApiUrl(`/admin/payments/invoices?${q.toString()}`), { headers });
  if (!res.ok) throw new Error(await readErrorMessage(res));

  const payload = await res.json() as {
    data?: InvoiceListItem[];
    meta?: Record<string, unknown> & {
      meta?: PaginatedMeta;
      summary?: InvoiceSummary;
      overallSummary?: InvoiceSummary;
      metrics?: InvoiceMetrics;
      filters?: InvoiceFilterOptions;
    };
  };

  const data = (payload.data ?? []) as InvoiceListItem[];
  const rawMeta = (payload.meta ?? {}) as Record<string, unknown> & {
    meta?: PaginatedMeta;
    summary?: InvoiceSummary;
    overallSummary?: InvoiceSummary;
    metrics?: InvoiceMetrics;
    filters?: InvoiceFilterOptions;
  };
  const meta = (rawMeta.meta ?? rawMeta) as PaginatedMeta;
  const defaultSummary: InvoiceSummary = {
    paid: { count: 0, amount: 0 },
    unpaid: { count: 0, amount: 0 },
    processing: { count: 0, amount: 0 },
    failed: { count: 0, amount: 0 },
    cancelled: { count: 0, amount: 0 },
    refunded: { count: 0, amount: 0 },
  };
  const summary = (rawMeta.summary ?? defaultSummary) as InvoiceSummary;
  const overallSummary = (rawMeta.overallSummary ?? defaultSummary) as InvoiceSummary;
  const metrics = (rawMeta.metrics ?? {
    totalInvoices: 0,
    totalAmount: 0,
    paidAmount: 0,
    outstandingAmount: 0,
    collectionRate: 0,
    averagePaidAmount: 0,
  }) as InvoiceMetrics;
  const filters = (rawMeta.filters ?? {
    tiers: [],
    paymentMethods: [],
    currencies: [],
    applicationStatuses: [],
    invoiceStatuses: [],
    followUpStatuses: [],
    feeTypes: [],
  }) as InvoiceFilterOptions;

  return { data, meta, summary, overallSummary, metrics, filters };
}

export function getProgramInvoice(id: string): Promise<InvoiceDetail> {
  return request<InvoiceDetail>(`/admin/payments/invoices/${id}`);
}

export function verifyInvoice(
  id: string,
  action: "approve" | "reject",
  reason?: string,
): Promise<unknown> {
  return request<unknown>(`/admin/payments/invoices/${id}/verify`, {
    method: "POST",
    body: JSON.stringify({ action, reason }),
  });
}

export function updateProgramInvoiceStatus(
  id: string,
  status: "unpaid" | "paid" | "processing" | "failed" | "cancelled" | "refunded",
  reason?: string,
): Promise<InvoiceListItem> {
  return request<InvoiceListItem>(`/admin/payments/invoices/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, reason }),
  });
}

// ─── Ambassadors ──────────────────────────────────────────────────────────────

export type Ambassador = {
  id: string;
  userId: string;
  programId: string;
  fullName: string;
  phoneNumber: string | null;
  referralCode: string;
  institution: string | null;
  gender: string | null;
  totalReferrals: number;
  successfulReferrals: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { email: string };
  program?: { id: string; name: string; slug: string } | null;
};

export type AmbassadorListMeta = { total: number; page: number; limit: number; lastPage: number };

export type AmbassadorDetail = Ambassador & {
  activatedAt?: string | null;
  deactivatedAt?: string | null;
  shareLink?: string | null;
  programName?: string;
  analytics?: {
    statusCounts: {
      referred: number;
      registered: number;
      applied: number;
      accepted: number;
      completed: number;
    };
    averageConversionDays: number | null;
  };
};

export type AmbassadorReferral = {
  id: string;
  status: string;
  participantId: string;
  participantName: string | null;
  participantEmail?: string | null;
  referredAt: string;
  registeredAt?: string | null;
  appliedAt?: string | null;
  acceptedAt?: string | null;
  completedAt?: string | null;
  daysToRegister?: number | null;
  daysToApply?: number | null;
  daysToAccept?: number | null;
  totalConversionDays?: number | null;
};

export type AmbassadorReferralsMeta = { total: number; page: number; limit: number; lastPage: number };

export async function listAmbassadors(params: {
  programId?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: Ambassador[]; meta: AmbassadorListMeta }> {
  const q = new URLSearchParams();
  if (params.programId) q.set("programId", params.programId);
  if (params.search) q.set("search", params.search);
  if (params.page) q.set("page", String(params.page));
  if (params.limit) q.set("limit", String(params.limit));
  // Handler returns { data: array, meta } → TransformInterceptor Pattern-1 extracts array.
  // Must use raw fetch to preserve meta alongside data.
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${getAccessToken()}`);
  const res = await fetch(buildApiUrl(`/admin/ambassadors?${q}`), { headers });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const payload = await res.json();
  const data: Ambassador[] = Array.isArray(payload.data) ? payload.data : [];
  const rawMeta = (payload.meta ?? {}) as { meta?: AmbassadorListMeta };
  const meta: AmbassadorListMeta = (rawMeta.meta ?? rawMeta) as AmbassadorListMeta ?? { total: 0, page: 1, limit: 20, lastPage: 1 };
  return { data, meta };
}

export function createAmbassador(data: {
  email: string;
  fullName: string;
  programId: string;
  phoneNumber?: string;
  institution?: string;
  gender?: string;
  notes?: string;
}): Promise<Ambassador> {
  return request<Ambassador>("/admin/ambassadors", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateAmbassador(
  id: string,
  data: { fullName?: string; phoneNumber?: string; institution?: string; gender?: string; notes?: string },
): Promise<Ambassador> {
  return request<Ambassador>(`/admin/ambassadors/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function activateAmbassador(id: string): Promise<unknown> {
  return request<unknown>(`/admin/ambassadors/${id}/activate`, { method: "PATCH" });
}

export function deactivateAmbassador(id: string): Promise<unknown> {
  return request<unknown>(`/admin/ambassadors/${id}/deactivate`, { method: "PATCH" });
}

export function deleteAmbassador(id: string): Promise<unknown> {
  return request<unknown>(`/admin/ambassadors/${id}`, { method: "DELETE" });
}

export function getAmbassador(id: string): Promise<AmbassadorDetail> {
  return request<AmbassadorDetail>(`/admin/ambassadors/${id}`);
}

export async function getAmbassadorReferrals(id: string, page = 1): Promise<{ data: AmbassadorReferral[]; meta: AmbassadorReferralsMeta }> {
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${getAccessToken()}`);
  const res = await fetch(buildApiUrl(`/admin/ambassadors/${id}/referrals?page=${page}`), { headers });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const payload = await res.json();
  const data: AmbassadorReferral[] = Array.isArray(payload.data) ? payload.data : [];
  const candidate = ((payload.meta ?? {}) as {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    lastPage?: number;
    meta?: {
      total?: number;
      page?: number;
      limit?: number;
      totalPages?: number;
      lastPage?: number;
    };
  }).meta ?? (payload.meta ?? {});
  const meta: AmbassadorReferralsMeta = {
    total: typeof candidate.total === "number" ? candidate.total : 0,
    page: typeof candidate.page === "number" ? candidate.page : page,
    limit: typeof candidate.limit === "number" ? candidate.limit : 20,
    lastPage:
      typeof candidate.lastPage === "number"
        ? candidate.lastPage
        : typeof candidate.totalPages === "number"
          ? candidate.totalPages
          : 1,
  };
  return { data, meta };
}

// ─── Reporting Exports ────────────────────────────────────────────────────────

async function triggerFileDownload(
  url: string,
  defaultFilename: string,
): Promise<void> {
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const blob = await response.blob();
  const filename =
    extractDownloadFilename(response.headers.get("content-disposition")) ??
    defaultFilename;

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

export function exportUsersExcel(): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  return triggerFileDownload(
    buildApiUrl("/reporting/users/export"),
    `users-export-${date}.xlsx`,
  );
}

export function exportParticipantsExcel(): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  return triggerFileDownload(
    buildApiUrl("/reporting/participants/export"),
    `participants-export-${date}.xlsx`,
  );
}

export function exportPaymentsExcel(): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  return triggerFileDownload(
    buildApiUrl("/reporting/payments/export"),
    `payments-export-${date}.xlsx`,
  );
}

export function exportAuditLogsExcel(): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  return triggerFileDownload(
    buildApiUrl("/reporting/audit-logs/export"),
    `audit-logs-${date}.xlsx`,
  );
}
