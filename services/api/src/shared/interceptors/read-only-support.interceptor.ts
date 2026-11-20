// services/api/src/shared/interceptors/read-only-support.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
// Ending the session is the one write a read-only view may do.
const LOGOUT_PATH = /^\/(v\d+\/)?auth\/logout$/;

export const READ_ONLY_IMPERSONATION_MODE = 'read_only';

/**
 * Rejects every state-changing request made with a read-only support-view
 * token. This is the single enforcement point: payment, file and notification
 * services never see the participant JWT (internal service key / RMQ only), so
 * a write can only reach them through an API route that this blocks first.
 *
 * An interceptor, not a guard: global guards run before JwtAuthGuard, so
 * request.user is not populated yet. Interceptors run after route guards.
 */
@Injectable()
export class ReadOnlySupportInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<{
      method: string;
      path?: string;
      user?: { impersonationMode?: string };
    }>();

    if (
      request.user?.impersonationMode === READ_ONLY_IMPERSONATION_MODE &&
      !SAFE_METHODS.has(request.method.toUpperCase()) &&
      !LOGOUT_PATH.test(request.path ?? '')
    ) {
      throw new ForbiddenException('Read-only support view');
    }

    return next.handle();
  }
}
