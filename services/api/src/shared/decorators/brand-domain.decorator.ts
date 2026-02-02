import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const BrandDomain = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    
    // Priority: 
    // 1. Header (Standard for API clients)
    // 2. Query Param (Fallback for testing/browser)
    return request.headers['x-brand-domain'] || request.query?.url;
  },
);
