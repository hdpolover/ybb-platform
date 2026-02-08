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

  // Admin cache keys
  STATS_DASHBOARD: (brandId: string, params: string) => `stats:dashboard:${brandId}:${params}`,
  PARTICIPANT_LIST: (programId: string) => `participants:program:${programId}`,
  PAYMENT_METHODS: (params: string) => `payment:methods:${params}`,

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
