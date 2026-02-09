import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserData {
  userId: string;
  email: string;
  brandId: string;
  jti?: string; // JWT unique token ID for blacklisting
  exp?: number; // Token expiration timestamp
  adminId?: string; // Admin ID for admin users
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUserData => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
