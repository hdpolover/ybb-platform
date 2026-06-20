import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export function cleanDomain(domain: string | undefined): string | undefined {
  if (!domain) return domain;
  
  // Normalize: lowercase, trim whitespace, and strip any trailing dots or
  // slashes. A fully-qualified host can arrive with a trailing dot
  // (e.g. "example.com." per RFC 2181) or a stray trailing slash, neither of
  // which matches the stored domain and would otherwise 404 the brand lookup.
  let cleaned = domain.toLowerCase().trim().replace(/[./]+$/, '');

  // Remove known subdomains used for testing/environments
  const prefixesToRemove = ['staging.', 'dev.', 'test.', 'www.'];
  
  for (const prefix of prefixesToRemove) {
    if (cleaned.startsWith(prefix)) {
      cleaned = cleaned.substring(prefix.length);
    }
  }
  
  return cleaned;
}

export const BrandDomain = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    
    // Priority: 
    // 1. Header (Standard for API clients)
    // 2. Query Param (Fallback for testing/browser)
    const rawDomain = request.headers['x-brand-domain'] || request.query?.url;
    return cleanDomain(rawDomain);
  },
);
