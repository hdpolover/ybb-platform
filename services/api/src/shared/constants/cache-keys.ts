/**
 * Cache key prefixes and TTL constants
 */

export const CACHE_KEYS = {
  PROGRAM_DETAIL: (identifier: string) => `program:detail:${identifier}`,
  PROGRAM_LIST: (params: string) => `program:list:${params}`,
  USER: (id: string) => `user:${id}`,
  USER_LIST: (brandId: string, skip: number, take: number) => `user:list:${brandId}:${skip}:${take}`,
  CATEGORY: (id: string) => `category:${id}`,
  TOKEN_BLACKLIST: (jti: string) => `auth:blacklist:${jti}`,
  AUTH_SESSIONS: (userId: string) => `auth:sessions:${userId}`,
  APPLICATION: (id: string) => `application:${id}`,
  APPLICATION_LIST: (params: string) => `application:list:${params}`,

  // Landing page cache keys
  LANDING_HOME: (brandId: string) => `landing:home:${brandId}`,
  LANDING_ABOUT: (brandId: string) => `landing:about:${brandId}`,
  LANDING_PROGRAMS: (brandId: string) => `landing:programs:${brandId}`,
  LANDING_PROGRAM_DETAIL: (brandId: string, slug: string) => `landing:program:${brandId}:${slug}`,
  LANDING_PARTNERS: (brandId: string) => `landing:partners:${brandId}`,
  LANDING_ANNOUNCEMENTS: (brandId: string) => `landing:announcements:${brandId}`,
  LANDING_FAQS: (brandId: string, page: number, limit: number, search: string) => `landing:faqs:${brandId}:${page}:${limit}:${search}`,
  LANDING_SETTINGS: (brandId: string) => `landing:settings:${brandId}`,
};

export const CACHE_TTL = {
  SHORT: 60 * 1000, // 1 minute
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 15 * 60 * 1000, // 15 minutes
  HOUR: 60 * 60 * 1000, // 1 hour
  DAY: 24 * 60 * 60 * 1000, // 24 hours (for very static content)
};
