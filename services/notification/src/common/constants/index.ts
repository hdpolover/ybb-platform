// Shared constants for YBB Platform

export const APP_NAME = 'YBB Platform';
export const APP_VERSION = '1.0.0';

// API Versions
export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// File Upload
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];
export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// JWT
export const JWT_EXPIRATION = '7d';
export const JWT_REFRESH_EXPIRATION = '30d';

// Rate Limiting
export const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
export const RATE_LIMIT_MAX_REQUESTS = 100;

// Cache TTL
export const CACHE_TTL_SHORT = 60; // 1 minute
export const CACHE_TTL_MEDIUM = 300; // 5 minutes
export const CACHE_TTL_LONG = 3600; // 1 hour

// Email
export const SUPPORT_EMAIL = 'support@ybbhub.com';
export const NO_REPLY_EMAIL = 'noreply@ybbhub.com';

// Date Formats
export const DATE_FORMAT = 'YYYY-MM-DD';
export const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
export const TIME_FORMAT = 'HH:mm:ss';

// Currency
export const DEFAULT_CURRENCY = 'USD';
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'IDR'];

// Roles
export const ADMIN_ROLE = 'admin';
export const STAFF_ROLE = 'staff';
export const USER_ROLE = 'user';

// Status Colors (for UI)
export const STATUS_COLORS = {
  active: 'green',
  inactive: 'gray',
  pending: 'yellow',
  completed: 'blue',
  failed: 'red',
  cancelled: 'orange',
};
