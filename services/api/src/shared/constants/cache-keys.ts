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
};

export const CACHE_TTL = {
  SHORT: 60 * 1000, // 1 minute
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 15 * 60 * 1000, // 15 minutes
  HOUR: 60 * 60 * 1000, // 1 hour
};
