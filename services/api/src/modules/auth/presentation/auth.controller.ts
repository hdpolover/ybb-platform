import { Controller, Post, Body, Get, UseGuards, HttpCode, HttpStatus, Headers, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiHeader, ApiQuery } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterAdminDto } from './dto/register-admin.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { FirebaseLoginDto } from './dto/firebase-login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { AdminAuthResponseDto } from './dto/admin-auth-response.dto'; // [NEW]
import { UserProfileDto } from './dto/user-profile.dto';
import { AdminLoginDto } from './dto/admin-login.dto'; // [NEW]
import { AdminRefreshDto } from './dto/admin-refresh.dto';
import { LinkLocalIdentityDto } from './dto/link-local-identity.dto';
import { LinkLocalIdentityResponseDto } from './dto/link-local-identity-response.dto';
import { LoginHandler } from '../application/commands/handlers/login.handler';
import { AdminLoginHandler } from '../application/commands/handlers/admin-login.handler'; // [NEW]
import { AdminRefreshHandler } from '../application/commands/handlers/admin-refresh.handler';
import { RegisterHandler } from '../application/commands/handlers/register.handler';
import { RegisterAdminHandler } from '../application/commands/handlers/register-admin.handler';
import { LogoutHandler } from '../application/commands/handlers/logout.handler';
import { ForgotPasswordHandler } from '../application/commands/handlers/forgot-password.handler';
import { ResetPasswordHandler } from '../application/commands/handlers/reset-password.handler';
import { VerifyEmailHandler } from '../application/commands/handlers/verify-email.handler';
import { ResendVerificationEmailHandler } from '../application/commands/handlers/resend-verification-email.handler';
import { FirebaseLoginHandler } from '../application/commands/handlers/firebase-login.handler';
import { LinkLocalIdentityHandler } from '../application/commands/handlers/link-local-identity.handler';
import { GetUserProfileHandler } from '../application/queries/handlers/get-user-profile.handler';
import { GetAuthProvidersHandler } from '../application/queries/handlers/get-auth-providers.handler';
import { GetAuthContextHandler } from '../application/queries/handlers/get-auth-context.handler';
import { LoginCommand } from '../application/commands/login.command';
import { AdminLoginCommand } from '../application/commands/admin-login.command'; // [NEW]
import { RegisterCommand } from '../application/commands/register.command';
import { RegisterAdminCommand } from '../application/commands/register-admin.command';
import { LogoutCommand } from '../application/commands/logout.command';
import { ForgotPasswordCommand } from '../application/commands/forgot-password.command';
import { ResetPasswordCommand } from '../application/commands/reset-password.command';
import { VerifyEmailCommand } from '../application/commands/verify-email.command';
import { ResendVerificationEmailCommand } from '../application/commands/resend-verification-email.command';
import { FirebaseLoginCommand } from '../application/commands/firebase-login.command';
import { LinkLocalIdentityCommand } from '../application/commands/link-local-identity.command';
import { AmbassadorLoginCommand } from '../application/commands/ambassador-login.command';
import { AmbassadorLoginDto } from './dto/ambassador-login.dto';
import { AmbassadorLoginHandler } from '../application/commands/handlers/ambassador-login.handler';
import { GetUserProfileQuery } from '../application/queries/get-user-profile.query';
import { GetAuthProvidersQuery } from '../application/queries/get-auth-providers.query';
import { GetAuthContextQuery } from '../application/queries/get-auth-context.query';
import { AuthContextResponseDto } from './dto/auth-context.dto';
import { Public } from '../../../shared/decorators/public.decorator';
import { CurrentUser, CurrentUserData } from '../../../shared/decorators/current-user.decorator';
import { BrandDomain } from '../../../shared/decorators/brand-domain.decorator';
import { JwtAuthGuard } from '../infrastructure/guards/jwt-auth.guard';
import { ClientIp } from '../../../shared/decorators/client-ip.decorator';
import { clientIpTracker, emailTracker } from '../../../shared/infrastructure/throttler/user-aware-throttler.guard';

const FIFTEEN_MINUTES = 900000;
const ONE_HOUR = 3600000;

/**
 * WHY THE PER-IP CEILINGS ARE LOOSE, AND WHY THAT IS THE RIGHT CALL.
 *
 * An IP is a BUILDING, not a person. A 40-seat school lab, a university, an
 * Indonesian carrier's CGNAT pool and one office all present as a single
 * address, and on a deadline day they all hit these routes at once. Sizing the
 * IP tier as if it were a per-user budget is what produced the ThrottlerException
 * reports on 2026-08-31: the Nth person through the door got locked out for the
 * rest of the window for doing nothing wrong.
 *
 * The IP tier does not have to bound per-account guessing, because the
 * per-MAILBOX tier below does (5 login attempts / 15 min for one address),
 * and an attacker cannot dodge that by changing hosts.
 *
 * There is a SECOND backstop, and it now covers all three routes here:
 *
 *   - /login and /admin/login increment failedLoginAttempts on a bad password
 *     and refuse the account once lockedUntil is set, per
 *     MAX_FAILED_LOGIN_ATTEMPTS (account-lockout.constants.ts).
 *   - /auth/ambassador-login authenticates on email + referral code with NO
 *     PASSWORD, so a wrong code is a wrong credential and costs the same: it
 *     counts a failed attempt and locks at the same threshold (the shared
 *     helper in account-lockout.util.ts). It had no lockout at all until then,
 *     which left code guessing bounded by these throttle tiers and nothing
 *     else.
 *
 * Nothing may quietly refund that counter either: /auth/firebase-login resets
 * failedLoginAttempts on a successful sign-in, and now refuses to do so while
 * lockedUntil is still running.
 *
 * So the IP tier only has to stop a single-host SPRAY — one attacker walking
 * many accounts from one address — not bound a building. At 600 per 15 minutes
 * that attacker gets ~40 login attempts a minute and every account they touch
 * still hits the 5-per-mailbox wall first. That is the trade the user chose:
 * loose enough that no legitimate building is ever locked out, tight enough
 * that one host cannot run a sweep at machine speed.
 */
const CREDENTIAL_THROTTLE = {
  // 600 per 15 min per client IP (a building), ANDed with
  // 5 per 15 min per mailbox (the per-account guessing budget).
  // The guard evaluates every configured throttler and requires all to pass.
  default: { limit: 600, ttl: FIFTEEN_MINUTES, getTracker: clientIpTracker },
  long: { limit: 5, ttl: FIFTEEN_MINUTES, getTracker: emailTracker },
};

/**
 * Mail-sending routes: the MAILBOX is the resource being protected, so that is
 * the tight tier. One address gets one mail allowance whoever asks, which is
 * safe to key on the caller-written body HERE and only here.
 *
 * The IP tier beside it exists so one host cannot mint unlimited buckets by
 * varying the address it sends, and is sized for a building for the reasons
 * above — a lab full of students registering together is normal traffic.
 */
const MAILBOX_THROTTLE = {
  default: { limit: 10, ttl: ONE_HOUR, getTracker: emailTracker },
  // Same building-sized ceiling as CREDENTIAL_THROTTLE, and for the same
  // reason. A route-level @Throttle REPLACES the global tier of that name
  // outright rather than ANDing with it, so writing an hour-long ttl here does
  // not tighten 300/60s into something stricter for an attacker — it hands a
  // whole school lab a 60-minute wall. Registration is the burstiest and most
  // deadline-clustered route we have, the guard runs BEFORE the validation
  // pipe so every 400 (weak password, duplicate email, missing consent) spends
  // budget too, and blockDuration is unset so it falls through to ttl: 40
  // students x 8 submits is 320, and everyone behind that NAT is out for an
  // hour. The 10/hour mailbox tier above is what protects a victim's inbox;
  // this tier only has to stop one host minting buckets by varying the address.
  long: { limit: 600, ttl: FIFTEEN_MINUTES, getTracker: clientIpTracker },
};

/**
 * Routes that carry an opaque token and no email, so there is no mailbox tier
 * to pin. An anonymous call here is per-IP — which makes it per-BUILDING; a
 * call carrying a valid access token is per-user, since the guard's default
 * tracker is user-aware. A tight cap here buys nothing and costs lockouts: nobody
 * guesses a 32-byte token, and nobody forges a Firebase-signed one either, so
 * a small-looking number is not protecting anything. All it does is lock a lab
 * out of finishing their signups. Sized to match the credential IP tier above,
 * for the same reason.
 */
const TOKEN_ROUTE_THROTTLE = { default: { limit: 600, ttl: FIFTEEN_MINUTES } };

@ApiTags('auth')
@Controller('auth')
@ApiHeader({
  name: 'x-brand-domain',
  description: 'Domain of the brand/program category (e.g., istanyouthsummit.com). This helps the system identify which brand context the user is authenticating against.',
  required: false,
})
export class AuthController {
  constructor(
    private readonly loginHandler: LoginHandler,
    private readonly adminLoginHandler: AdminLoginHandler, // [NEW]
    private readonly adminRefreshHandler: AdminRefreshHandler,
    private readonly ambassadorLoginHandler: AmbassadorLoginHandler,
    private readonly registerHandler: RegisterHandler,
    private readonly registerAdminHandler: RegisterAdminHandler,
    private readonly logoutHandler: LogoutHandler,
    private readonly forgotPasswordHandler: ForgotPasswordHandler,
    private readonly resetPasswordHandler: ResetPasswordHandler,
    private readonly verifyEmailHandler: VerifyEmailHandler,
    private readonly resendVerificationEmailHandler: ResendVerificationEmailHandler,
    private readonly firebaseLoginHandler: FirebaseLoginHandler,
    private readonly linkLocalIdentityHandler: LinkLocalIdentityHandler,
    private readonly getUserProfileHandler: GetUserProfileHandler,
    private readonly getAuthProvidersHandler: GetAuthProvidersHandler,
    private readonly getAuthContextHandler: GetAuthContextHandler,
  ) { }

  @Public()
  @Post('firebase-login')
  // Carries a Firebase idToken, no email; see TOKEN_ROUTE_THROTTLE. 20/15min
  // was the same lockout shape as the credential routes below — a lab doing
  // Google sign-in exhausted it before lunch and everyone on that address got
  // a 429 for the rest of the window.
  @Throttle(TOKEN_ROUTE_THROTTLE)
  @ApiOperation({ summary: 'Login/Register with Firebase Token (Google, Apple, etc.)' })
  @ApiResponse({ status: 200, description: 'User successfully logged in or registered', type: AuthResponseDto })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  async firebaseLogin(
    @Body() dto: FirebaseLoginDto,
    @BrandDomain() brandDomain?: string,
    @ClientIp() ip?: string,
    @Req() req?: Request,
  ): Promise<AuthResponseDto> {
    const userAgent = req?.headers['user-agent'] || 'unknown';
    const command = new FirebaseLoginCommand(
      dto.idToken,
      dto.providerId,
      ip || '0.0.0.0',
      userAgent,
      dto.brandId,
      dto.programId,
      dto.programSlug,
      dto.referralCode,
      dto.applicationCategory,
    );
    return this.firebaseLoginHandler.execute(command, brandDomain);
  }

  @Public()
  @Post('login')
  // Two ceilings, both must pass. See CREDENTIAL_THROTTLE for the sizing
  // argument. The email tier ALONE (what this route used to have) is not a
  // limit at all on a credential route: the caller writes the body, so spraying
  // one password across many accounts never touches the same bucket twice.
  @Throttle(CREDENTIAL_THROTTLE)
  @ApiOperation({ summary: 'Login User' })
  @ApiResponse({ status: 200, description: 'User successfully logged in', type: AuthResponseDto })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  async login(
    @Body() dto: LoginDto,
    @BrandDomain() brandDomain?: string,
    @ClientIp() ip?: string,
    @Req() req?: Request,
  ): Promise<AuthResponseDto> {
    const userAgent = req?.headers['user-agent'] || 'unknown';
    const command = new LoginCommand(
      dto.email,
      dto.password,
      ip || '0.0.0.0',
      userAgent,
      dto.brandId,
      dto.programId,
      dto.programSlug,
    );
    return this.loginHandler.execute(command, brandDomain);
  }

  @Public()
  @Post('ambassador-login')
  // Same two ceilings as /login; see CREDENTIAL_THROTTLE.
  @Throttle(CREDENTIAL_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ambassador Login (email + referral code)' })
  @ApiResponse({ status: 200, description: 'Ambassador successfully logged in', type: AuthResponseDto })
  async ambassadorLogin(
    @Body() dto: AmbassadorLoginDto,
    @BrandDomain() brandDomain?: string,
    @ClientIp() ip?: string,
    @Req() req?: Request,
  ): Promise<AuthResponseDto> {
    const userAgent = req?.headers['user-agent'] || 'unknown';
    const command = new AmbassadorLoginCommand(
      dto.email,
      dto.referralCode,
      ip || '0.0.0.0',
      userAgent,
      dto.brandId,
    );
    return this.ambassadorLoginHandler.execute(command, brandDomain);
  }

  @Public()
  @Post('admin/login')
  // Same two ceilings as /login; see CREDENTIAL_THROTTLE. Admins share an
  // office IP as readily as students share a lab one.
  @Throttle(CREDENTIAL_THROTTLE)
  @ApiOperation({ summary: 'Admin Login' })
  @ApiResponse({ status: 200, description: 'Admin successfully logged in', type: AdminAuthResponseDto })
  async adminLogin(
    @Body() dto: AdminLoginDto,
    @ClientIp() ip?: string,
    @Req() req?: Request,
  ): Promise<AdminAuthResponseDto> {
    const userAgent = req?.headers['user-agent'] || 'unknown';
    const command = new AdminLoginCommand(
      dto.email,
      dto.password,
      ip || '0.0.0.0',
      userAgent,
    );
    return this.adminLoginHandler.execute(command);
  }

  @Public()
  @Post('admin/refresh')
  // Carries a refresh token, no email, so this is per-IP — i.e. per OFFICE.
  // 20 was a per-person number applied to a building; see TOKEN_ROUTE_THROTTLE.
  @Throttle(TOKEN_ROUTE_THROTTLE)
  @ApiOperation({ summary: 'Refresh Admin Session' })
  @ApiResponse({ status: 200, description: 'Admin tokens refreshed successfully', type: AdminAuthResponseDto })
  async adminRefresh(@Body() dto: AdminRefreshDto): Promise<AdminAuthResponseDto> {
    return this.adminRefreshHandler.execute(dto.refreshToken);
  }

  @Public()
  @Post('register')
  // 10/hour per mailbox AND 600/15min per IP; see MAILBOX_THROTTLE.
  @Throttle(MAILBOX_THROTTLE)
  @ApiOperation({
    summary: 'Register User',
    description: `
      Registers a new user with support for "Smart Registration" features:
      
      - **Program Slug**: Provide \`programSlug\` (e.g., 'ybb-15') to automatically register the user for a specific program.
      - **Referral Code**: Provide \`referralCode\` (e.g., 'K9X2M4P1') to unknowingly credit an ambassador.
      - **Brand Context**: Use the \`x-brand-domain\` header or \`url\` query parameter to automatically infer the Program Category.
      - **Auth Provider**: Use \`providerId\` (UUID) to specify the authentication configuration (Local, Google, etc.).
    `
  })
  @ApiResponse({ status: 201, description: 'User successfully registered', type: AuthResponseDto })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  async register(
    @Body() dto: RegisterDto,
    @BrandDomain() brandDomain?: string,
    @ClientIp() ip?: string,
    @Req() req?: Request,
  ): Promise<AuthResponseDto> {
    const userAgent = req?.headers['user-agent'] || 'unknown';
    const command = new RegisterCommand(
      dto.email,
      dto.providerId,
      dto.password,
      dto.brandId,
      dto.providerUserId,
      dto.programId,
      dto.programSlug,
      dto.referralCode,
      ip || '0.0.0.0',
      userAgent,
      dto.applicationCategory,
    );
    return this.registerHandler.execute(command, brandDomain);
  }

  @Public()
  @Post('register-admin')
  // 3 guesses per hour at the shared secret, per client IP. clientIpTracker is
  // named EXPLICITLY and must stay that way: the guard's default tracker is
  // user-aware, and /auth/register hands out an access token immediately with
  // no email verification, so leaving this on the default would let a caller
  // mint throwaway accounts (~2400/hour per IP under MAILBOX_THROTTLE) and
  // spend a fresh 3-guess bucket per account — thousands of guesses an hour
  // against an intended 3. This is the one route in this file whose security
  // rests on a small number, so it does not get to inherit a tracker.
  @Throttle({ default: { limit: 3, ttl: ONE_HOUR, getTracker: clientIpTracker } })
  @ApiOperation({ summary: 'Register Admin (Requires Secret Key)' })
  @ApiResponse({ status: 201, description: 'Admin successfully registered', type: AuthResponseDto })
  async registerAdmin(@Body() dto: RegisterAdminDto): Promise<AuthResponseDto> {
    const command = new RegisterAdminCommand(
      dto.email,
      dto.password,
      dto.fullName,
      dto.secretKey,
      dto.brandId,
      dto.role,
      dto.additionalBrandIds,
    );
    return this.registerAdminHandler.execute(command);
  }

  @Public()
  @Post('forgot-password')
  // 10/hour per mailbox AND 600/15min per IP; see MAILBOX_THROTTLE.
  @Throttle(MAILBOX_THROTTLE)
  @ApiOperation({ summary: 'Request Password Reset' })
  @ApiResponse({ status: 201, description: 'Password reset email sent' })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @BrandDomain() brandDomain?: string,
    @ClientIp() ip?: string,
    @Req() req?: Request,
  ) {
    const userAgent = req?.headers['user-agent'] || 'unknown';
    const command = new ForgotPasswordCommand(dto.email, dto.brandId, ip || '0.0.0.0', userAgent);
    return this.forgotPasswordHandler.execute(command, brandDomain);
  }

  @Public()
  @Post('reset-password')
  // Carries a reset token, no email; see TOKEN_ROUTE_THROTTLE.
  @Throttle(TOKEN_ROUTE_THROTTLE)
  @ApiOperation({ summary: 'Reset Password' })
  @ApiResponse({ status: 201, description: 'Password successfully reset' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @ClientIp() ip?: string,
    @Req() req?: Request,
  ) {
    const userAgent = req?.headers['user-agent'] || 'unknown';
    const command = new ResetPasswordCommand(dto.token, dto.password, ip || '0.0.0.0', userAgent);
    return this.resetPasswordHandler.execute(command);
  }

  @Public()
  @Post('verify-email')
  // Carries a verification token, no email; see TOKEN_ROUTE_THROTTLE.
  @Throttle(TOKEN_ROUTE_THROTTLE)
  @ApiOperation({ summary: 'Verify Email' })
  @ApiResponse({ status: 201, description: 'Email successfully verified' })
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @ClientIp() ip?: string,
    @Req() req?: Request,
  ) {
    const userAgent = req?.headers['user-agent'] || 'unknown';
    const command = new VerifyEmailCommand(dto.token, ip || '0.0.0.0', userAgent);
    return this.verifyEmailHandler.execute(command);
  }

  @Public()
  @Post('resend-verification')
  // 10/hour per mailbox AND 600/15min per IP; see MAILBOX_THROTTLE.
  @Throttle(MAILBOX_THROTTLE)
  @ApiOperation({ summary: 'Resend Verification Email' })
  @ApiResponse({ status: 200, description: 'Verification email sent if user exists and is unverified' })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  async resendVerification(
    @Body() dto: ResendVerificationDto,
    @BrandDomain() brandDomain?: string,
    @ClientIp() ip?: string,
    @Req() req?: Request,
  ) {
    const userAgent = req?.headers['user-agent'] || 'unknown';
    const command = new ResendVerificationEmailCommand(dto.email, dto.brandId, ip || '0.0.0.0', userAgent);
    return this.resendVerificationEmailHandler.execute(command, brandDomain);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout User' })
  @ApiResponse({ status: 200, description: 'Successfully logged out' })
  async logout(@CurrentUser() user: CurrentUserData) {
    if (!user.jti || !user.exp) {
      return { success: true, message: 'Logged out (token not trackable)' };
    }

    const command = new LogoutCommand(user.userId, user.jti, user.exp, user.sid);
    return this.logoutHandler.execute(command);
  }

  @Post('identities/local')
  @HttpCode(HttpStatus.CREATED)
  // Per authenticated USER, back to the original intent: the throttler is
  // still a global APP_GUARD that runs before this route's JwtAuthGuard, so
  // req.user is still undefined when the tracker is called — but the guard now
  // verifies the Bearer token itself and keys on its subject (ab35c318). A
  // caller with no valid token still keys on the client IP.
  // The 60/hour is the widened value from when this tier was per-IP and one
  // building shared it; as a per-user budget the original figure was 5/hour.
  @Throttle({ default: { limit: 60, ttl: ONE_HOUR } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add Email & Password Sign-in to the Current Account' })
  @ApiResponse({ status: 201, description: 'Local sign-in added', type: LinkLocalIdentityResponseDto })
  @ApiResponse({ status: 409, description: 'Local sign-in is already configured' })
  async linkLocalIdentity(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: LinkLocalIdentityDto,
  ): Promise<LinkLocalIdentityResponseDto> {
    const command = new LinkLocalIdentityCommand(user.userId, dto.password);
    return this.linkLocalIdentityHandler.execute(command);
  }

  @Get('me')
  // NOTE: bare @SkipThrottle() is `{ default: true }` — it skips ONLY the
  // throttler named 'default'. The short/medium/long tiers still apply.
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Current User Profile' })
  @ApiResponse({
    status: 200,
    description: 'Current user profile information',
    type: UserProfileDto,
  })
  async getProfile(@CurrentUser() user: CurrentUserData) {
    const query = new GetUserProfileQuery(user.userId, user.brandId);
    return this.getUserProfileHandler.execute(query);
  }

  @Public()
  @Get('providers')
  @SkipThrottle()
  @ApiOperation({ summary: 'Get Authentication Providers' })
  @ApiResponse({
    status: 200,
    description: 'List of active authentication providers configuration for frontend rendering',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'google' },
          displayName: { type: 'string', example: 'Google' },
          description: { type: 'string', example: 'Sign in with Google account' },
          isOAuth: { type: 'boolean', example: true },
          icon: { type: 'string', example: 'google' },
          buttonColor: { type: 'string', example: '#4285F4' },
        },
      },
    },
  })
  async getProviders() {
    const query = new GetAuthProvidersQuery();
    return this.getAuthProvidersHandler.execute(query);
  }

  @Public()
  @Get('context')
  @SkipThrottle()
  @ApiOperation({
    summary: 'Resolve auth context (brand + active program + local provider) by domain',
    description:
      'Used by participant frontends to bootstrap registration/login. Resolves the brand from the x-brand-domain header (or ?url query) and returns the active program for that brand. Replaces brittle client-side filtering of /v1/brands + /v1/programs.',
  })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website domain (alternative to x-brand-domain header)' })
  @ApiResponse({ status: 200, type: AuthContextResponseDto })
  async getContext(@BrandDomain() brandDomain?: string): Promise<AuthContextResponseDto> {
    return this.getAuthContextHandler.execute(new GetAuthContextQuery(brandDomain));
  }
}
