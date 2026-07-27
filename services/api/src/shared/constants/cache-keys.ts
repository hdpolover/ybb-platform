/**
 * Cache key prefixes and TTL constants
 */

export const CACHE_KEYS = {
  PROGRAM_DETAIL: (identifier: string) => `program:detail:${identifier}`,
  PROGRAM_LIST: (params: string) => `program:list:${params}`,
  USER: (id: string) => `user:${id}`,
  USER_LIST: (brandId: string, skip: number, take: number, role?: string) => `user:list:${brandId}:${skip}:${take}:${role || 'all'}`,
  CATEGORY: (id: string) => `category:${id}`,
  TOKEN_BLACKLIST: (jti: string) => `auth:blacklist:${jti}`,
  AUTH_SESSIONS: (userId: string) => `auth:sessions:${userId}`,
  APPLICATION: (id: string) => `application:${id}`,

  APPLICATION_LIST: (brandId?: string, programId?: string, params?: string) => `application:list:${brandId || 'all'}:${programId || 'all'}:${params}`,

  // Landing page cache keys
  LANDING_HOME: (brandId: string) => `landing:home:${brandId}`,
  LANDING_ABOUT: (brandId: string) => `landing:about:${brandId}`,
  LANDING_PROGRAMS: (brandId: string) => `landing:programs:${brandId}`,
  LANDING_PROGRAM_DETAIL: (brandId: string, slug: string) => `landing:program:${brandId}:${slug}`,
  LANDING_PARTNERS: (brandId: string) => `landing:partners:${brandId}`,
  LANDING_ANNOUNCEMENTS: (brandId: string) => `landing:announcements:${brandId}`,
  LANDING_FAQS: (brandId: string, page: number, limit: number, search: string) => `landing:faqs:${brandId}:${page}:${limit}:${search}`,
  LANDING_SETTINGS: (brandId: string) => `landing:settings:${brandId}`,
  LANDING_ACTIVITY: (brandId: string) => `landing:activity:${brandId}`,
  LANDING_SNAPSHOT: (brandId: string, page: string, slug: string = '') => `landing:snapshot:${brandId}:${page}:${slug || 'root'}`,

  // Portal cache keys
  PORTAL_DASHBOARD: (userId: string) => `portal:dashboard:${userId}`,
  PORTAL_SUBMISSIONS: (userId: string, programId?: string) => `portal:submissions:${userId}:${programId || 'latest'}`,
  PORTAL_PAYMENTS: (userId: string, programId?: string) => `portal:payments:${userId}:${programId || 'latest'}`,
  // userId is included in the key to prevent cross-participant cache leakage (IDOR).
  PORTAL_PAYMENT_DETAIL: (userId: string, invoiceId: string) => `portal:payment-detail:${userId}:${invoiceId}`,
  PORTAL_DOCUMENTS: (userId: string) => `portal:documents:${userId}`,
  PORTAL_SUBMISSION_DETAIL: (userId: string, programId?: string) => `portal:submission-detail:${userId}:${programId || 'latest'}`,
  PORTAL_CERTIFICATES: (userId: string) => `portal:certificates:${userId}`,

  // Participant cache keys (for optimized lookups)
  PARTICIPANT_PROFILE: (userId: string) => `participant:profile:${userId}`,
  PARTICIPANT_STATS: (participantId: string) => `participant:stats:${participantId}`,
  PARTICIPANT_LATEST_APP: (participantId: string) => `participant:latest-app:${participantId}`,

  // Program data cache keys (static/semi-static data)
  PROGRAM_ESSAYS: (programId: string) => `program:essays:${programId}`,
  PROGRAM_REQUIREMENTS: (programId: string) => `program:requirements:${programId}`,
  PROGRAM_PRICING: (programId: string) => `program:pricing:${programId}`,
  PROGRAM_RESOURCES: (programId: string) => `program:resources:${programId}`,
  PROGRAM_ANNOUNCEMENTS: (programId: string, userId: string) => `program:announcements:${programId}:user:${userId}`,

  // Admin cache keys
  STATS_DASHBOARD: (brandId: string, params: string) => `stats:dashboard:${brandId}:${params}`,
  STATS_ADMIN_ANALYTICS: (brandId?: string) => `stats:admin:analytics:${brandId || 'all'}`,
  STATS_ADMIN_PROGRAM_DASHBOARD: (programId: string) => `stats:admin:program:${programId}:dashboard`,
  PARTICIPANT_LIST: (programId: string) => `participants:program:${programId}`,
  PAYMENT_METHODS: (params: string) => `payment:methods:${params}`,
  // Program-scoped merged (fallback-aware) payment methods list. Distinct
  // prefix from PAYMENT_METHODS so program-scoped writes never touch/invalidate
  // the global payment methods cache.
  PROGRAM_PAYMENT_METHODS: (programId: string) => `payment:methods:program:${programId}`,

  // Participant analytics cache keys
  ANALYTICS_KNOWLEDGE_SOURCE: (programId: string) => `analytics:knowledge-source:${programId}`,
  ANALYTICS_NATIONALITY: (programId: string) => `analytics:nationality:${programId}`,
  ANALYTICS_GENDER: (programId: string) => `analytics:gender:${programId}`,
  ANALYTICS_AGE: (programId: string) => `analytics:age:${programId}`,
  ANALYTICS_REGISTRATIONS: (programId: string) => `analytics:registrations:${programId}`,
  ANALYTICS_AMBASSADORS: (programId: string) => `analytics:ambassadors:${programId}`,

  // Metadata cache keys
  METADATA_COUNTRIES: 'metadata:countries',
  METADATA_STATES: (countryCode: string) => `metadata:states:${countryCode}`,
  METADATA_CITIES: (countryCode: string, stateCode?: string) => `metadata:cities:${countryCode}:${stateCode || 'all'}`,
  METADATA_TIMEZONES: (search?: string) => `metadata:timezones:${search || 'all'}`,
  METADATA_CURRENCIES: 'metadata:currencies',
  METADATA_GENDERS: 'metadata:genders',
  METADATA_APP_CATEGORIES: 'metadata:app-categories',
  METADATA_SHIRT_SIZES: 'metadata:shirt-sizes',
  METADATA_DIETARY: 'metadata:dietary',
  METADATA_KNOWLEDGE_SOURCES: 'metadata:knowledge-sources',
  METADATA_ENUMS: 'metadata:enums',
};

export const CACHE_TTL = {
  SHORT: 60 * 1000, // 1 minute
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 15 * 60 * 1000, // 15 minutes
  HOUR: 60 * 60 * 1000, // 1 hour
  DAY: 24 * 60 * 60 * 1000, // 24 hours (for very static content)
};
