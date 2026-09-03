import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserData {
  userId: string;
  email: string;
  brandId: string;
  role?: string[] | string;
  jti?: string; // JWT unique token ID for blacklisting
  exp?: number; // Token expiration timestamp
  adminId?: string; // Admin ID for admin users
  sid?: string; // Session ID when token is tied to a persisted session
  impersonatedByAdminId?: string; // Set only on an admin-impersonation session
  impersonationTicketId?: string; // The ticket that minted that session
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUserData => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
