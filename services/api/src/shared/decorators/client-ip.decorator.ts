// src/shared/decorators/client-ip.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { resolveClientIp } from '../utils/client-ip';

/**
 * The caller's address, resolved through the proxy chain.
 *
 * Nest's `@Ip()` returns `req.ip`, which is the socket peer — behind Traefik
 * and Cloudflare that is a load balancer, identical for every request on the
 * planet. Login GeoIP, session rows and the forgot-password security trail all
 * recorded that one constant, so a credential-stuffing sweep looked exactly
 * like normal traffic in the logs.
 *
 * Falls back to '0.0.0.0' so downstream string handling stays simple; every
 * call site already had that fallback spelled out inline.
 */
export const ClientIp = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  return resolveClientIp(request) ?? '0.0.0.0';
});
