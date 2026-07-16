import { Controller, Post, Body, Get, UseGuards, HttpCode, HttpStatus, Headers, Query, Ip, Req } from '@nestjs/common';
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
    private readonly getUserProfileHandler: GetUserProfileHandler,
    private readonly getAuthProvidersHandler: GetAuthProvidersHandler,
    private readonly getAuthContextHandler: GetAuthContextHandler,
  ) { }

  @Public()
  @Post('firebase-login')
  @Throttle({ default: { limit: 20, ttl: 900000 } }) // Higher limit than login
  @ApiOperation({ summary: 'Login/Register with Firebase Token (Google, Apple, etc.)' })
  @ApiResponse({ status: 200, description: 'User successfully logged in or registered', type: AuthResponseDto })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  async firebaseLogin(
    @Body() dto: FirebaseLoginDto,
    @BrandDomain() brandDomain?: string,
    @Ip() ip?: string,
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
    );
    return this.firebaseLoginHandler.execute(command, brandDomain);
  }

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 attempts per 15 minutes
  @ApiOperation({ summary: 'Login User' })
  @ApiResponse({ status: 200, description: 'User successfully logged in', type: AuthResponseDto })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  async login(
    @Body() dto: LoginDto,
    @BrandDomain() brandDomain?: string,
    @Ip() ip?: string,
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
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ambassador Login (email + referral code)' })
  @ApiResponse({ status: 200, description: 'Ambassador successfully logged in', type: AuthResponseDto })
  async ambassadorLogin(
    @Body() dto: AmbassadorLoginDto,
    @BrandDomain() brandDomain?: string,
    @Ip() ip?: string,
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
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Admin Login' })
  @ApiResponse({ status: 200, description: 'Admin successfully logged in', type: AdminAuthResponseDto })
  async adminLogin(
    @Body() dto: AdminLoginDto,
    @Ip() ip?: string,
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
  @Throttle({ default: { limit: 20, ttl: 900000 } })
  @ApiOperation({ summary: 'Refresh Admin Session' })
  @ApiResponse({ status: 200, description: 'Admin tokens refreshed successfully', type: AdminAuthResponseDto })
  async adminRefresh(@Body() dto: AdminRefreshDto): Promise<AdminAuthResponseDto> {
    return this.adminRefreshHandler.execute(dto.refreshToken);
  }

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 attempts per hour
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
    @Ip() ip?: string,
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
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 attempts per hour
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
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @ApiOperation({ summary: 'Request Password Reset' })
  @ApiResponse({ status: 201, description: 'Password reset email sent' })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @BrandDomain() brandDomain?: string,
    @Ip() ip?: string,
    @Req() req?: Request,
  ) {
    const userAgent = req?.headers['user-agent'] || 'unknown';
    const command = new ForgotPasswordCommand(dto.email, dto.brandId, ip || '0.0.0.0', userAgent);
    return this.forgotPasswordHandler.execute(command, brandDomain);
  }

  @Public()
  @Post('reset-password')
  @Throttle({ default: { limit: 3, ttl: 900000 } })
  @ApiOperation({ summary: 'Reset Password' })
  @ApiResponse({ status: 201, description: 'Password successfully reset' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Ip() ip?: string,
    @Req() req?: Request,
  ) {
    const userAgent = req?.headers['user-agent'] || 'unknown';
    const command = new ResetPasswordCommand(dto.token, dto.password, ip || '0.0.0.0', userAgent);
    return this.resetPasswordHandler.execute(command);
  }

  @Public()
  @Post('verify-email')
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Verify Email' })
  @ApiResponse({ status: 201, description: 'Email successfully verified' })
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Ip() ip?: string,
    @Req() req?: Request,
  ) {
    const userAgent = req?.headers['user-agent'] || 'unknown';
    const command = new VerifyEmailCommand(dto.token, ip || '0.0.0.0', userAgent);
    return this.verifyEmailHandler.execute(command);
  }

  @Public()
  @Post('resend-verification')
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // Limit to prevent spam
  @ApiOperation({ summary: 'Resend Verification Email' })
  @ApiResponse({ status: 200, description: 'Verification email sent if user exists and is unverified' })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  async resendVerification(
    @Body() dto: ResendVerificationDto,
    @BrandDomain() brandDomain?: string,
    @Ip() ip?: string,
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

  @Get('me')
  @SkipThrottle() // Skip throttling for authenticated user info
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
