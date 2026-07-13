import { z } from "zod";
import { redirectToLogin } from "@/src/shared/login-redirect";
import {
  requestAdminProfileRefresh,
  shouldRefreshAdminProfileForMutation,
} from "@/src/shared/admin-profile-refresh";

export type PlatformBrand = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  websiteUrl?: string | null;
  landingUrl?: string | null;
  primaryColor?: string | null;
  isActive: boolean;
  programCount: number;
  createdAt: string;
  updatedAt: string;
};

type RawPlatformBrand = Partial<PlatformBrandDetail> & {
  logo_url?: string | null;
  banner_url?: string | null;
  website_url?: string | null;
  landing_url?: string | null;
  primary_color?: string | null;
  is_active?: boolean;
  program_count?: number;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_whatsapp?: string | null;
  contact_address?: string | null;
  social_media_links?: Record<string, string> | null;
  default_location?: string | null;
  default_country?: string | null;
  default_timezone?: string | null;
  require_email_verification?: boolean;
  default_currency?: string;
  enable_multi_currency?: boolean;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string | null;
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
  paymentInfoHtml?: string | null;
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

function normalizePlatformBrand(raw: RawPlatformBrand): PlatformBrand {
  return {
    id: raw.id ?? "",
    name: raw.name ?? "",
    slug: raw.slug ?? "",
    description: raw.description ?? null,
    logoUrl: raw.logoUrl ?? raw.logo_url ?? null,
    bannerUrl: raw.bannerUrl ?? raw.banner_url ?? null,
    websiteUrl: raw.websiteUrl ?? raw.website_url ?? null,
    landingUrl: raw.landingUrl ?? raw.landing_url ?? null,
    primaryColor: raw.primaryColor ?? raw.primary_color ?? null,
    isActive: raw.isActive ?? raw.is_active ?? false,
    programCount: raw.programCount ?? raw.program_count ?? 0,
    createdAt: raw.createdAt ?? raw.created_at ?? "",
    updatedAt: raw.updatedAt ?? raw.updated_at ?? raw.createdAt ?? raw.created_at ?? "",
  };
}

function normalizePlatformBrandDetail(raw: RawPlatformBrand): PlatformBrandDetail {
  return {
    ...normalizePlatformBrand(raw),
    about: raw.about ?? null,
    vision: raw.vision ?? null,
    mission: raw.mission ?? null,
    contactEmail: raw.contactEmail ?? raw.contact_email ?? null,
    contactPhone: raw.contactPhone ?? raw.contact_phone ?? null,
    contactWhatsapp: raw.contactWhatsapp ?? raw.contact_whatsapp ?? null,
    contactAddress: raw.contactAddress ?? raw.contact_address ?? null,
    socialMediaLinks: raw.socialMediaLinks ?? raw.social_media_links ?? null,
    defaultLocation: raw.defaultLocation ?? raw.default_location ?? null,
    defaultCountry: raw.defaultCountry ?? raw.default_country ?? null,
    defaultTimezone: raw.defaultTimezone ?? raw.default_timezone ?? null,
    requireEmailVerification: raw.requireEmailVerification ?? raw.require_email_verification ?? false,
    defaultCurrency: raw.defaultCurrency ?? raw.default_currency ?? "USD",
    enableMultiCurrency: raw.enableMultiCurrency ?? raw.enable_multi_currency ?? false,
    metaTitle: raw.metaTitle ?? raw.meta_title ?? null,
    metaDescription: raw.metaDescription ?? raw.meta_description ?? null,
    metaKeywords: raw.metaKeywords ?? raw.meta_keywords ?? null,
    settings:
      raw.settings && typeof raw.settings === "object" && !Array.isArray(raw.settings)
        ? (raw.settings as PlatformBrandDetail["settings"])
        : null,
  };
}

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
    redirectToLogin("session_expired");
    throw new Error("Session expired. Redirecting to login...");
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
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${getAccessToken()}`);

  if (!(init?.body instanceof FormData) && method !== "GET" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(buildApiUrl(path), {
    ...init,
    cache: init?.cache ?? (method === "GET" ? "no-store" : undefined),
    headers,
  });

  if (response.status === 401) {
    redirectToLogin("session_expired");
    throw new Error("Session expired. Redirecting to login...");
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  if (response.status === 204) {
    if (shouldRefreshAdminProfileForMutation(path, method)) {
      requestAdminProfileRefresh();
    }
    return undefined as T;
  }

  const payload = (await response.json()) as ApiEnvelope<unknown> | T;
  let result: T;

  if (options?.unwrapData === false) {
    result = payload as T;
  } else if (payload && typeof payload === "object" && "data" in (payload as ApiEnvelope<unknown>)) {
    result = (payload as ApiEnvelope<T>).data;
  } else {
    result = payload as T;
  }

  if (shouldRefreshAdminProfileForMutation(path, method)) {
    requestAdminProfileRefresh();
  }

  return result;
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
    // The backend never returns the raw token (write-only secret) — only
    // whether one is currently set, so the UI can render a masked placeholder.
    hasCapiAccessToken?: boolean;
    // Not secret — the Meta Events Manager test_event_code is safe to display
    // and edit like any other field.
    capiTestEventCode?: string | null;
  } | null;
};

export function listPlatformBrands(): Promise<PlatformBrand[]> {
  return request<RawPlatformBrand[]>("/brands").then((brands) => brands.map(normalizePlatformBrand));
}

export function getPlatformBrand(brandId: string): Promise<PlatformBrandDetail> {
  return request<RawPlatformBrand>(`/brands/${brandId}`).then(normalizePlatformBrandDetail);
}

export async function updatePlatformBrandIdentity(
  brandId: string,
  input: {
    name: string;
    slug: string;
    description?: string;
    websiteUrl?: string;
    landingUrl?: string;
    primaryColor?: string;
    contactEmail?: string;
    isActive?: boolean;
    logo?: File | null;
    banner?: File | null;
    userId?: string;
  },
): Promise<PlatformBrandDetail> {
  // Upload logo + banner via the presigned flow before the save call so the
  // bytes never pass through our API. The backend DTO accepts logoUrl/bannerUrl
  // string fields — when those are present and no file blob is attached, the
  // brand handler skips its own upload and just persists the URL we pass.
  const { uploadFileViaPresignedUrl } = await import("@/src/shared/api-client");

  let logoUrl: string | undefined;
  let bannerUrl: string | undefined;

  if (input.logo) {
    if (!input.userId) throw new Error("userId is required when uploading a logo.");
    const result = await uploadFileViaPresignedUrl(input.logo, {
      userId: input.userId,
      brandId,
      // Matches the PUBLIC_CATEGORIES whitelist on the file service so the
      // returned public URL is actually reachable without a signature.
      bucket: "brands/logos",
      assetType: "logo",
    });
    if (!result.publicUrl) {
      throw new Error("Logo uploaded but no public URL was returned.");
    }
    logoUrl = result.publicUrl;
  }

  if (input.banner) {
    if (!input.userId) throw new Error("userId is required when uploading a banner.");
    const result = await uploadFileViaPresignedUrl(input.banner, {
      userId: input.userId,
      brandId,
      bucket: "brands/banners",
      assetType: "banner",
    });
    if (!result.publicUrl) {
      throw new Error("Banner uploaded but no public URL was returned.");
    }
    bannerUrl = result.publicUrl;
  }

  const formData = new FormData();
  formData.set("name", input.name);
  formData.set("slug", input.slug);
  if (input.description != null) formData.set("description", input.description);
  if (input.websiteUrl != null) formData.set("websiteUrl", input.websiteUrl);
  if (input.landingUrl != null) formData.set("landingUrl", input.landingUrl);
  if (input.primaryColor != null) formData.set("primaryColor", input.primaryColor);
  if (input.contactEmail != null) formData.set("contactEmail", input.contactEmail);
  if (input.isActive != null) formData.set("isActive", String(input.isActive));
  if (logoUrl) formData.set("logoUrl", logoUrl);
  if (bannerUrl) formData.set("bannerUrl", bannerUrl);
  return request<RawPlatformBrand>(`/brands/${brandId}`, { method: "PUT", body: formData }).then(normalizePlatformBrandDetail);
}

/**
 * Uploads brand logo/banner directly as multipart to PUT /brands/:id.
 * Matches the program branding approach — no presigned URLs, no userId needed.
 */
export function updatePlatformBrandMedia(
  brandId: string,
  brand: { name: string; slug: string },
  files: { logo?: File | null; banner?: File | null },
): Promise<PlatformBrandDetail> {
  const formData = new FormData();
  formData.set("name", brand.name);
  formData.set("slug", brand.slug);
  if (files.logo) formData.append("logo", files.logo);
  if (files.banner) formData.append("banner", files.banner);
  return request<RawPlatformBrand>(`/brands/${brandId}`, { method: "PUT", body: formData }).then(normalizePlatformBrandDetail);
}

export function updatePlatformBrandDetails(
  brandId: string,
  input: {
    about?: string;
    vision?: string;
    mission?: string;
    contactEmail?: string;
    contactPhone?: string;
    contactWhatsapp?: string;
    contactAddress?: string;
    socialMediaLinks?: Record<string, string>;
    defaultLocation?: string;
    defaultCountry?: string;
    defaultTimezone?: string;
    metaTitle?: string;
    metaDescription?: string;
    metaKeywords?: string;
  },
): Promise<PlatformBrandDetail> {
  const formData = new FormData();
  if (input.about != null) formData.set("about", input.about);
  if (input.vision != null) formData.set("vision", input.vision);
  if (input.mission != null) formData.set("mission", input.mission);
  if (input.contactEmail != null) formData.set("contactEmail", input.contactEmail);
  if (input.contactPhone != null) formData.set("contactPhone", input.contactPhone);
  if (input.contactWhatsapp != null) formData.set("contactWhatsapp", input.contactWhatsapp);
  if (input.contactAddress != null) formData.set("contactAddress", input.contactAddress);
  if (input.socialMediaLinks != null)
    formData.set("socialMediaLinks", JSON.stringify(input.socialMediaLinks));
  if (input.defaultLocation != null) formData.set("defaultLocation", input.defaultLocation);
  if (input.defaultCountry != null) formData.set("defaultCountry", input.defaultCountry);
  if (input.defaultTimezone != null) formData.set("defaultTimezone", input.defaultTimezone);
  if (input.metaTitle != null) formData.set("metaTitle", input.metaTitle);
  if (input.metaDescription != null) formData.set("metaDescription", input.metaDescription);
  if (input.metaKeywords != null) formData.set("metaKeywords", input.metaKeywords);
  return request<RawPlatformBrand>(`/brands/${brandId}/details`, { method: "PUT", body: formData }).then(normalizePlatformBrandDetail);
}

export function updatePlatformBrandSettings(
  brandId: string,
  input: {
    requireEmailVerification?: boolean;
    defaultCurrency?: string;
    enableMultiCurrency?: boolean;
    isMaintenanceMode?: boolean;
    maintenanceMessage?: string;
    googleAnalyticsId?: string;
    pixelId?: string;
    supportEmail?: string;
    // Omit entirely (do not send "") when the admin didn't type a new value —
    // the backend leaves the stored token unchanged when this key is absent.
    capiAccessToken?: string;
    capiTestEventCode?: string;
  },
): Promise<PlatformBrandDetail> {
  return request<RawPlatformBrand>(`/brands/${brandId}/settings`, {
    method: "PUT",
    body: JSON.stringify(input),
  }).then(normalizePlatformBrandDetail);
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

  return request<RawPlatformBrand>("/brands", {
    method: "POST",
    body: formData,
  }).then(normalizePlatformBrand);
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

  return request<RawPlatformBrand>(`/brands/${brandId}`, {
    method: "PUT",
    body: formData,
  }).then(normalizePlatformBrand);
}

export function deletePlatformBrand(brandId: string): Promise<void> {
  return request<void>(`/brands/${brandId}`, {
    method: "DELETE",
  });
}

// ─── Brand Landing Page Metadata ──────────────────────────────────────────────

export type BenefitItem = string;

export type BenefitGroup = {
  id: string;
  title: string;
  imageUrl?: string;
  items: BenefitItem[];
};

export type BrandFeature = {
  id: string;
  icon: string;
  title: string;
  description: string;
};

export type BrandImpactStats = {
  total_participants?: string;
  total_countries?: string;
  total_alumni?: string;
  editions_held?: string;
};

export type BrandSectionBackground = {
  desktop_url?: string;
  mobile_url?: string;
  /** Controls text visibility on top of the background image. 'light' = white text, 'dark' = dark text (default). */
  text_color_scheme?: 'light' | 'dark';
};

export type BrandPromoCta = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  primary_cta_label?: string;
  primary_cta_href?: string;
  video_url?: string;
  video_title?: string;
  video_description?: string;
};

export type BrandMomentsShorts = {
  eyebrow?: string;
  title?: string;
  description?: string;
};

export type BrandProgramObjectives = {
  eyebrow?: string;
  title?: string;
  intro?: string;
  items?: string[];
};

export type BrandFurtherInformation = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  background_image_url?: string;
  background_image_mobile_url?: string;
  mockup_image_url?: string;
};

export type BrandPaymentInfoItem = {
  id: string;
  icon: string;
  title: string;
  body: string;
};

export type BrandPaymentInfo = {
  eyebrow: string;
  title: string;
  introText: string;
  items: BrandPaymentInfoItem[];
  note: string;
};

export type AffiliateCommissionMetadata = {
  fullyFundedPct: number;
  selfFundedPct: number;
};

export type BrandMetadata = {
  benefits?: { eyebrow: string; title: string; groups: BenefitGroup[] };
  features?: BrandFeature[];
  impact_stats?: BrandImpactStats;
  promo_cta?: BrandPromoCta;
  moments_shorts?: BrandMomentsShorts;
  program_objectives?: BrandProgramObjectives;
  further_information?: BrandFurtherInformation;
  /** Global background image used by all landing sections (benefits, shorts, promo CTA, further info). */
  section_background?: BrandSectionBackground;
  partners_canva_url?: string | null;
  affiliateCommission?: AffiliateCommissionMetadata | null;
  recognition?: Record<string, unknown>;
  payment_info?: BrandPaymentInfo;
  participant_demographics?: Record<string, unknown>;
  [key: string]: unknown;
};

// Legacy/malformed metadata records can reach the API with the wrong shape
// for these array-bearing fields (e.g. `groups` missing, a group missing its
// `items` array). The UI iterates over them directly (see LandingPageTab in
// BrandDetailPage.tsx), so a bad shape throws a TypeError during render and
// takes down the whole page. Sanitize defensively at the fetch boundary
// instead of trusting the payload — never throw here, always fall back to a
// safe default so `getBrandMetadata` itself can never reject/crash on bad data.
const unknownArraySchema = z.array(z.unknown());

function toSafeArray(value: unknown): unknown[] {
  const result = unknownArraySchema.safeParse(value);
  return result.success ? result.data : [];
}

function sanitizeBenefitGroup(group: unknown): BenefitGroup {
  const record = group && typeof group === "object" ? (group as Record<string, unknown>) : {};
  return {
    ...record,
    items: toSafeArray(record.items) as BenefitItem[],
  } as BenefitGroup;
}

function sanitizeBenefits(benefits: BrandMetadata["benefits"]): BrandMetadata["benefits"] {
  if (!benefits || typeof benefits !== "object") return benefits;
  return {
    ...benefits,
    groups: toSafeArray(benefits.groups).map(sanitizeBenefitGroup),
  };
}

function sanitizeProgramObjectives(
  objectives: BrandMetadata["program_objectives"],
): BrandMetadata["program_objectives"] {
  if (!objectives || typeof objectives !== "object" || objectives.items === undefined) {
    return objectives;
  }
  return {
    ...objectives,
    items: toSafeArray(objectives.items) as string[],
  };
}

function sanitizeBrandMetadata(raw: unknown): BrandMetadata {
  if (!raw || typeof raw !== "object") return raw as BrandMetadata;

  try {
    const value = raw as BrandMetadata;
    return {
      ...value,
      benefits: value.benefits !== undefined ? sanitizeBenefits(value.benefits) : value.benefits,
      features: value.features !== undefined ? (toSafeArray(value.features) as BrandFeature[]) : value.features,
      program_objectives:
        value.program_objectives !== undefined
          ? sanitizeProgramObjectives(value.program_objectives)
          : value.program_objectives,
    };
  } catch {
    // Last-resort safety net — never let sanitization itself crash the fetch.
    return raw as BrandMetadata;
  }
}

export function getBrandMetadata(brandId: string): Promise<BrandMetadata> {
  return request<BrandMetadata>(`/brands/${brandId}/metadata`).then(sanitizeBrandMetadata);
}

export function updatePlatformBrandMetadata(
  brandId: string,
  patch: Partial<BrandMetadata>,
): Promise<BrandMetadata> {
  return request<BrandMetadata>(`/brands/${brandId}/metadata`, {
    method: "PUT",
    body: JSON.stringify({ patch }),
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
  description?: string | null;
};

export function listBrandSponsors(brandId: string): Promise<BrandSponsor[]> {
  return request<BrandSponsor[]>(`/brands/${brandId}/sponsors`, { cache: "no-store" });
}

export function createBrandSponsor(
  brandId: string,
  input: {
    name: string;
    type: string;
    tier?: string;
    websiteUrl?: string;
    description?: string;
    order?: number;
    logo?: File | null;
    logoUrl?: string | null;
  },
): Promise<BrandSponsor> {
  const formData = new FormData();
  formData.set("name", input.name);
  formData.set("type", input.type);
  if (input.tier) formData.set("tier", input.tier);
  if (input.websiteUrl) formData.set("websiteUrl", input.websiteUrl);
  if (input.description) formData.set("description", input.description);
  if (input.order != null) formData.set("order", String(input.order));
  if (input.logo) formData.append("logo", input.logo);
  if (input.logoUrl?.trim()) formData.set("logoUrl", input.logoUrl.trim());
  return request<BrandSponsor>(`/brands/${brandId}/sponsors`, { method: "POST", body: formData });
}

export function updateBrandSponsor(
  brandId: string,
  sponsorId: string,
  input: {
    name?: string;
    type?: string;
    tier?: string | null;
    websiteUrl?: string | null;
    description?: string | null;
    order?: number;
    logo?: File | null;
    logoUrl?: string | null;
  },
): Promise<BrandSponsor> {
  const formData = new FormData();
  if (input.name != null) formData.set("name", input.name);
  if (input.type != null) formData.set("type", input.type);
  if (input.tier !== undefined) formData.set("tier", input.tier ?? "");
  if (input.websiteUrl !== undefined) formData.set("websiteUrl", input.websiteUrl ?? "");
  if (input.description !== undefined) formData.set("description", input.description ?? "");
  if (input.order != null) formData.set("order", String(input.order));
  if (input.logo) formData.append("logo", input.logo);
  if (input.logoUrl !== undefined) formData.set("logoUrl", input.logoUrl?.trim() ?? "");
  return request<BrandSponsor>(`/brands/${brandId}/sponsors/${sponsorId}`, { method: "PUT", body: formData });
}

export function deleteBrandSponsor(brandId: string, sponsorId: string): Promise<void> {
  return request<void>(`/brands/${brandId}/sponsors/${sponsorId}`, { method: "DELETE" });
}

export type BrandSocialFeed = {
  id: string;
  platform: string;
  postId: string;
  permalink: string;
  imageUrl: string;
  caption?: string | null;
  postedAt: string;
  isActive: boolean;
};

function normalizeBrandSocialFeed(input: unknown): BrandSocialFeed {
  const value = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const postedAt =
    typeof value.postedAt === "string"
      ? value.postedAt
      : value.postedAt instanceof Date
        ? value.postedAt.toISOString()
        : "";

  return {
    id: typeof value.id === "string" ? value.id : "",
    platform: typeof value.platform === "string" ? value.platform : "instagram",
    postId: typeof value.postId === "string" ? value.postId : "",
    permalink: typeof value.permalink === "string" ? value.permalink : "",
    imageUrl: typeof value.imageUrl === "string" ? value.imageUrl : "",
    caption: typeof value.caption === "string" ? value.caption : null,
    postedAt,
    isActive: value.isActive === true,
  };
}

export function listBrandSocialFeeds(brandId: string): Promise<BrandSocialFeed[]> {
  return request<unknown[]>(`/brands/${brandId}/social-feeds`, { cache: "no-store" }).then((items) =>
    Array.isArray(items) ? items.map(normalizeBrandSocialFeed) : [],
  );
}

export function createBrandSocialFeed(
  brandId: string,
  input: {
    postId?: string;
    permalink: string;
    imageUrl?: string;
    caption?: string | null;
    postedAt?: string;
    isActive?: boolean;
  },
): Promise<BrandSocialFeed> {
  return request<unknown>(`/brands/${brandId}/social-feeds`, {
    method: "POST",
    body: JSON.stringify({
      platform: "instagram",
      ...input,
    }),
  }).then(normalizeBrandSocialFeed);
}

export function updateBrandSocialFeed(
  brandId: string,
  socialFeedId: string,
  input: {
    postId?: string;
    permalink?: string;
    imageUrl?: string;
    caption?: string | null;
    postedAt?: string;
    isActive?: boolean;
  },
): Promise<BrandSocialFeed> {
  return request<unknown>(`/brands/${brandId}/social-feeds/${socialFeedId}`, {
    method: "PUT",
    body: JSON.stringify(input),
  }).then(normalizeBrandSocialFeed);
}

export function deleteBrandSocialFeed(brandId: string, socialFeedId: string): Promise<void> {
  return request<void>(`/brands/${brandId}/social-feeds/${socialFeedId}`, { method: "DELETE" });
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

type RawAdminOption = {
  id: string;
  fullName: string;
  email?: string | null;
  user?: { email?: string | null } | null;
};

export function listAllAdmins(search?: string): Promise<AdminOption[]> {
  const qs = new URLSearchParams({ limit: "100", page: "1" });
  if (search) qs.set("search", search);
  return request<RawAdminOption[]>(`/admins?${qs.toString()}`).then((admins) =>
    admins.map((admin) => ({
      id: admin.id,
      fullName: admin.fullName,
      email: admin.email ?? admin.user?.email ?? "",
    })),
  );
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

/**
 * Fetch a single program by ID via the admin-only endpoint, which bypasses the
 * global soft-delete filter and includes admin-only fields like
 * `paymentInfoHtml`.
 *
 * The endpoint returns a richer shape than the list/create/update endpoints
 * (e.g. brand object, content fields). The return type here is intentionally
 * narrow — extend `PlatformProgram` if more fields are needed by callers.
 */
export function getPlatformProgramById(programId: string): Promise<PlatformProgram> {
  return request<PlatformProgram>(`/admin/programs/${programId}`);
}

/**
 * Update or clear the rich-text payment info shown to participants on the
 * payment page. Pass `null` to clear the existing value, or an HTML string
 * to set it.
 *
 * Returns void — the backend acknowledges with `{ message }` only and does
 * not echo the updated program. Callers that need fresh program state
 * should refetch via `getPlatformProgramById`.
 */
export function updateProgramPaymentInfo(
  programId: string,
  paymentInfoHtml: string | null,
): Promise<void> {
  return request<{ message: string }>(
    `/programs/${programId}/payment-info`,
    {
      method: "PUT",
      body: JSON.stringify({ paymentInfoHtml }),
    },
    { unwrapData: false },
  ).then(() => undefined);
}

// ─── Pricing Tiers & Validity Periods ─────────────────────────────────────────

export type ValidityPeriod = {
  id: string;
  pricingTierId: string;
  startDate: string;
  endDate: string;
  description?: string;
};

type RawValidityPeriod = Partial<ValidityPeriod> & {
  pricing_tier_id?: string;
  start_date?: string;
  end_date?: string;
};

export type PricingTier = {
  id: string;
  programId: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  usdPrice: number;
  idrPrice: number;
  feeType?: string;
  allowedCategories?: string[];
  capacity?: number;
  soldCount: number;
  isActive: boolean;
  order: number;
  icon?: string;
  benefits?: string[];
  requirements?: string[];
  validityPeriods: ValidityPeriod[];
};

type RawPricingTier = Partial<PricingTier> & {
  program_id?: string;
  fee_type?: string;
  allowed_categories?: string[];
  sold_count?: number;
  is_active?: boolean;
  validity_periods?: RawValidityPeriod[];
  usd_price?: number;
  idr_price?: number;
};

function normalizeValidityPeriod(raw: RawValidityPeriod): ValidityPeriod {
  return {
    id: raw.id ?? "",
    pricingTierId: raw.pricingTierId ?? raw.pricing_tier_id ?? "",
    startDate: raw.startDate ?? raw.start_date ?? "",
    endDate: raw.endDate ?? raw.end_date ?? "",
    description: raw.description ?? undefined,
  };
}

function normalizePricingTier(raw: RawPricingTier): PricingTier {
  const periods = (raw.validityPeriods ?? raw.validity_periods ?? []) as RawValidityPeriod[];
  const usdPrice = Number(raw.usdPrice ?? raw.usd_price ?? raw.price ?? 0);
  const idrPrice = Number(raw.idrPrice ?? raw.idr_price ?? 0);

  return {
    id: raw.id ?? "",
    programId: raw.programId ?? raw.program_id ?? "",
    name: raw.name ?? "",
    description: raw.description ?? undefined,
    price: Number(raw.price ?? raw.usdPrice ?? raw.usd_price ?? 0),
    currency: raw.currency ?? "USD",
    usdPrice,
    idrPrice,
    feeType: raw.feeType ?? raw.fee_type ?? undefined,
    allowedCategories: raw.allowedCategories ?? raw.allowed_categories ?? undefined,
    capacity: raw.capacity ?? undefined,
    soldCount: raw.soldCount ?? raw.sold_count ?? 0,
    isActive: raw.isActive ?? raw.is_active ?? false,
    order: raw.order ?? 0,
    icon: raw.icon ?? undefined,
    benefits: raw.benefits ?? undefined,
    requirements: raw.requirements ?? undefined,
    validityPeriods: periods.map(normalizeValidityPeriod),
  };
}

export function getPricingTiers(programId: string): Promise<PricingTier[]> {
  return request<RawPricingTier[]>(`/programs/${programId}/pricing-tiers`).then((tiers) =>
    tiers.map(normalizePricingTier),
  );
}

export function getPricingTierById(tierId: string): Promise<PricingTier | null> {
  return request<RawPricingTier | null>(`/programs/pricing-tiers/${tierId}`).then((tier) =>
    tier ? normalizePricingTier(tier) : null,
  );
}

export function createPricingTier(
  programId: string,
  data: {
    name: string;
    description?: string;
    usdPrice: number;
    idrPrice: number;
    feeType?: string;
    allowedCategories?: string[];
    capacity?: number;
    isActive?: boolean;
    order?: number;
    icon?: string;
    benefits?: string[];
    requirements?: string[];
    validFrom: string;
    validUntil: string;
  },
): Promise<PricingTier> {
  return request<RawPricingTier>(`/programs/${programId}/pricing-tiers`, {
    method: "POST",
    body: JSON.stringify({ ...data, programId }),
  }).then(normalizePricingTier);
}

export function updatePricingTier(
  tierId: string,
  data: Partial<{
    name: string;
    description: string;
    usdPrice: number;
    idrPrice: number;
    feeType: string;
    allowedCategories: string[];
    capacity: number;
    isActive: boolean;
    order: number;
    icon: string;
    benefits: string[];
    requirements: string[];
    validFrom: string;
    validUntil: string;
  }>,
): Promise<PricingTier> {
  return request<RawPricingTier>(`/programs/pricing-tiers/${tierId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }).then(normalizePricingTier);
}

export function deletePricingTier(tierId: string): Promise<void> {
  return request<void>(`/programs/pricing-tiers/${tierId}`, { method: "DELETE" });
}

export function createValidityPeriod(
  tierId: string,
  data: { startDate: string; endDate: string; description?: string },
): Promise<ValidityPeriod> {
  return request<RawValidityPeriod>(`/programs/pricing-tiers/${tierId}/periods`, {
    method: "POST",
    body: JSON.stringify(data),
  }).then(normalizeValidityPeriod);
}

export function updateValidityPeriod(
  periodId: string,
  data: { startDate?: string; endDate?: string; description?: string },
): Promise<ValidityPeriod> {
  return request<RawValidityPeriod>(`/programs/validity-periods/${periodId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }).then(normalizeValidityPeriod);
}

export function deleteValidityPeriod(periodId: string): Promise<void> {
  return request<void>(`/programs/validity-periods/${periodId}`, { method: "DELETE" });
}

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
