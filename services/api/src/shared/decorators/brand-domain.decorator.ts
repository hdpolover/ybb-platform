import { createParamDecorator, ExecutionContext } from '@nestjs/common';

function cleanDomain(domain: string | undefined): string | undefined {
  if (!domain) return domain;
  
  // Remove known subdomains used for testing/environments
  let cleaned = domain.toLowerCase().trim();
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
