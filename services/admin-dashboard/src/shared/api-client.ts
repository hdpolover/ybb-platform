/**
 * Shared API client for the admin dashboard.
 *
 * Single source of truth for all API calls. Builds on the same
 * patterns as `app/platform/api.ts` (JWT Bearer, env base URL,
 * unwrap `data` envelope automatically).
 */

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
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  return token;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (typeof body.message === "string") return body.message;
  } catch { /* fall through */ }
  return `Request failed with status ${res.status}.`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
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

  if (!res.ok) throw new Error(await readErrorMessage(res));
  if (res.status === 204) return undefined as T;

  const payload = await res.json();
  // Unwrap `{ data: ... }` envelope if present
  if (payload && typeof payload === "object" && "data" in payload) {
    return payload.data as T;
  }
  return payload as T;
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

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdminRole = {
  id: string;
  name: string;
  permissions: Record<string, boolean>;
  isActive: boolean;
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
  accessLevel: string | null;
  canManageAdmins: boolean;
  canAssignRoles: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateAdminInput = {
  email: string;
  fullName: string;
  password: string;
  roleId?: string;
  brandIds?: string[];
};

export type UpdateAdminInput = {
  fullName?: string;
  roleId?: string;
  brandIds?: string[];
  isActive?: boolean;
};

export type User = {
  id: string;
  email: string;
  brandId: string | null;
  isActive: boolean;
  emailVerified: boolean;
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

export type ProgramFaq = {
  id: string;
  programId: string;
  question: string;
  answer: string;
  category: string;
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
  isKeynote: boolean;
  order: number;
  external_url: string | null;
};

export type ProgramTestimonial = {
  id: string;
  programId: string | null;
  brandId: string | null;
  name: string;
  role: string | null;
  country: string | null;
  content: string;
  photoUrl: string | null;
  isActive: boolean;
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

export type ProgramSchedule = {
  id: string;
  programId: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  location: string | null;
  speakerId: string | null;
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

export type PaymentMethod = {
  id: string;
  name: string;
  code: string;
  type: string;
  paymentType: string;
  isActive: boolean;
  iconUrl: string | null;
  minAmount: number | null;
  maxAmount: number | null;
  currencies: string[];
};

export type Application = {
  id: string;
  programId: string;
  participantId: string;
  status: string;
  applicationCategory: string;
  scoreTotal: number | null;
  scoreStatus: string | null;
  registrationPaymentStatus: string;
  programPaymentStatus: string;
  createdAt: string;
  updatedAt: string;
  participant?: {
    id: string;
    fullName: string;
    user?: { email: string };
    originCountry: string | null;
  };
  program?: { id: string; name: string };
};

export type ProgramAnnouncement = {
  id: string;
  programId: string;
  title: string;
  content: string;
  type: string;
  priority: string;
  target: string;
  expiresAt: string | null;
  showBanner: boolean;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

// ─── Admins ───────────────────────────────────────────────────────────────────

export function listAdmins(params?: {
  page?: number;
  limit?: number;
  search?: string;
  roleId?: string;
  brandId?: string;
}): Promise<Paginated<Admin>> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.search) q.set("search", params.search);
  if (params?.roleId) q.set("roleId", params.roleId);
  if (params?.brandId) q.set("brandId", params.brandId);
  return request<Paginated<Admin>>(`/admins?${q}`);
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

export function listAdminRoles(): Promise<AdminRole[]> {
  return request<AdminRole[]>("/admin-roles");
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

export function updateProgramFaq(id: string, input: Partial<ProgramFaq>): Promise<ProgramFaq> {
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
    isKeynote?: boolean;
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
  if (input.isKeynote !== undefined) fd.set("isKeynote", String(input.isKeynote));
  if (input.order !== undefined) fd.set("order", String(input.order));
  if (input.photo) fd.set("photo", input.photo);
  return request<ProgramSpeaker>(`/programs/${programId}/speakers`, {
    method: "POST",
    body: fd,
  });
}

export function updateProgramSpeaker(
  id: string,
  input: Partial<Omit<ProgramSpeaker, "id" | "programId" | "photoUrl">> & { photo?: File },
): Promise<ProgramSpeaker> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined && k !== "photo") fd.set(k, String(v));
  }
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
  input: { name: string; role?: string; country?: string; content: string; programId?: string },
): Promise<ProgramTestimonial> {
  return request<ProgramTestimonial>(`/programs/${programId}/testimonials`, {
    method: "POST",
    body: JSON.stringify({ ...input, programId }),
  });
}

export function updateProgramTestimonial(
  id: string,
  input: Partial<ProgramTestimonial>,
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
  return request<ProgramTimeline[]>(`/programs/${programId}/timeline`);
}

export function createProgramTimelineItem(
  programId: string,
  input: { title: string; description?: string; date: string; endDate?: string; order?: number; type?: string },
): Promise<ProgramTimeline> {
  return request<ProgramTimeline>(`/programs/${programId}/timeline`, {
    method: "POST",
    body: JSON.stringify({ ...input, programId }),
  });
}

export function updateProgramTimelineItem(
  id: string,
  input: Partial<ProgramTimeline>,
): Promise<ProgramTimeline> {
  return request<ProgramTimeline>(`/programs/timeline/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
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
  input: { title: string; description?: string; startTime: string; endTime?: string; location?: string; order?: number },
): Promise<ProgramSchedule> {
  return request<ProgramSchedule>(`/programs/${programId}/schedules`, {
    method: "POST",
    body: JSON.stringify({ ...input, programId }),
  });
}

export function updateProgramSchedule(
  id: string,
  input: Partial<ProgramSchedule>,
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

export function createProgramGalleryItem(
  programId: string,
  input: { title?: string; description?: string; year?: number; order?: number; image: File },
): Promise<ProgramGalleryItem> {
  const fd = new FormData();
  fd.set("programId", programId);
  if (input.title) fd.set("title", input.title);
  if (input.description) fd.set("description", input.description);
  if (input.year !== undefined) fd.set("year", String(input.year));
  if (input.order !== undefined) fd.set("order", String(input.order));
  fd.set("image", input.image);
  return request<ProgramGalleryItem>(`/programs/${programId}/gallery`, {
    method: "POST",
    body: fd,
  });
}

export function updateProgramGalleryItem(
  id: string,
  input: Partial<Omit<ProgramGalleryItem, "id" | "programId" | "imageUrl">> & { image?: File },
): Promise<ProgramGalleryItem> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined && k !== "image") fd.set(k, String(v));
  }
  if (input.image) fd.set("image", input.image);
  return request<ProgramGalleryItem>(`/programs/gallery/${id}`, {
    method: "PUT",
    body: fd,
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
  return request<PaymentMethod>("/admin/payments/methods", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePaymentMethod(id: string, input: Partial<PaymentMethod>): Promise<PaymentMethod> {
  return request<PaymentMethod>(`/admin/payments/methods/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deletePaymentMethod(id: string): Promise<void> {
  return request<void>(`/admin/payments/methods/${id}`, { method: "DELETE" });
}

// ─── Applications / Submissions / Participants ────────────────────────────────

export function listApplications(params?: {
  programId?: string;
  participantId?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
  brandId?: string;
}): Promise<{ data: Application[]; total: number }> {
  const q = new URLSearchParams();
  if (params?.programId) q.set("programId", params.programId);
  if (params?.participantId) q.set("participantId", params.participantId);
  if (params?.status) q.set("status", params.status);
  if (params?.search) q.set("search", params.search);
  if (params?.limit !== undefined) q.set("limit", String(params.limit));
  if (params?.offset !== undefined) q.set("offset", String(params.offset));
  if (params?.brandId) q.set("brandId", params.brandId);
  return request<{ data: Application[]; total: number }>(`/applications?${q}`);
}

export function getApplication(id: string): Promise<Application> {
  return request<Application>(`/applications/${id}?includeRelations=true`);
}

export function reviewApplication(
  id: string,
  input: { status: string; reviewerNote?: string; reviewerId: string },
): Promise<Application> {
  return request<Application>(`/applications/${id}/review`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ─── Program Announcements ────────────────────────────────────────────────────

export function listProgramAnnouncements(
  programId: string,
  params?: { page?: number; limit?: number; type?: string; priority?: string },
): Promise<Paginated<ProgramAnnouncement>> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.type) q.set("type", params.type);
  if (params?.priority) q.set("priority", params.priority);
  return request<Paginated<ProgramAnnouncement>>(
    `/programs/${programId}/announcements?${q}`,
  );
}

export function createProgramAnnouncement(
  programId: string,
  input: {
    title: string;
    content: string;
    type?: string;
    priority?: string;
    target?: string;
    expiresAt?: string;
    showBanner?: boolean;
  },
): Promise<ProgramAnnouncement> {
  return request<ProgramAnnouncement>(`/programs/${programId}/announcements`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateProgramAnnouncement(
  id: string,
  input: Partial<ProgramAnnouncement>,
): Promise<ProgramAnnouncement> {
  return request<ProgramAnnouncement>(`/programs/announcements/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteProgramAnnouncement(id: string): Promise<void> {
  return request<void>(`/programs/announcements/${id}`, { method: "DELETE" });
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
