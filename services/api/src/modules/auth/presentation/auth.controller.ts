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
import { AuthResponseDto } from './dto/auth-response.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { LoginHandler } from '../application/commands/handlers/login.handler';
import { RegisterHandler } from '../application/commands/handlers/register.handler';
import { RegisterAdminHandler } from '../application/commands/handlers/register-admin.handler';
import { LogoutHandler } from '../application/commands/handlers/logout.handler';
import { ForgotPasswordHandler } from '../application/commands/handlers/forgot-password.handler';
import { ResetPasswordHandler } from '../application/commands/handlers/reset-password.handler';
import { VerifyEmailHandler } from '../application/commands/handlers/verify-email.handler';
import { ResendVerificationEmailHandler } from '../application/commands/handlers/resend-verification-email.handler';
import { GetUserProfileHandler } from '../application/queries/handlers/get-user-profile.handler';
import { GetAuthProvidersHandler } from '../application/queries/handlers/get-auth-providers.handler';
import { LoginCommand } from '../application/commands/login.command';
import { RegisterCommand } from '../application/commands/register.command';
import { RegisterAdminCommand } from '../application/commands/register-admin.command';
import { LogoutCommand } from '../application/commands/logout.command';
import { ForgotPasswordCommand } from '../application/commands/forgot-password.command';
import { ResetPasswordCommand } from '../application/commands/reset-password.command';
import { VerifyEmailCommand } from '../application/commands/verify-email.command';
import { ResendVerificationEmailCommand } from '../application/commands/resend-verification-email.command';
import { GetUserProfileQuery } from '../application/queries/get-user-profile.query';
import { GetAuthProvidersQuery } from '../application/queries/get-auth-providers.query';
import { Public } from '../../../shared/decorators/public.decorator';
import { CurrentUser, CurrentUserData } from '../../../shared/decorators/current-user.decorator';
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
    private readonly registerHandler: RegisterHandler,
    private readonly registerAdminHandler: RegisterAdminHandler,
    private readonly logoutHandler: LogoutHandler,
    private readonly forgotPasswordHandler: ForgotPasswordHandler,
    private readonly resetPasswordHandler: ResetPasswordHandler,
    private readonly verifyEmailHandler: VerifyEmailHandler,
    private readonly resendVerificationEmailHandler: ResendVerificationEmailHandler,
    private readonly getUserProfileHandler: GetUserProfileHandler,
    private readonly getAuthProvidersHandler: GetAuthProvidersHandler,
  ) { }

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 attempts per 15 minutes
  @ApiOperation({ summary: 'Login User' })
  @ApiResponse({ status: 200, description: 'User successfully logged in', type: AuthResponseDto })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  async login(
    @Body() dto: LoginDto,
    @Query('url') url?: string,
    @Headers('x-brand-domain') brandDomain?: string,
    @Ip() ip?: string,
    @Req() req?: Request,
  ): Promise<AuthResponseDto> {
    const userAgent = req?.headers['user-agent'] || 'unknown';
    const command = new LoginCommand(
      dto.email,
      dto.password,
      ip || '0.0.0.0',
      userAgent,
      dto.programCategoryId,
    );
    return this.loginHandler.execute(command, url || brandDomain);
  }

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 attempts per hour
  @ApiOperation({ summary: 'Register User' })
  @ApiResponse({ status: 201, description: 'User successfully registered', type: AuthResponseDto })
  @ApiQuery({ name: 'url', required: false, description: 'Brand website URL' })
  async register(
    @Body() dto: RegisterDto,
    @Query('url') url?: string,
    @Headers('x-brand-domain') brandDomain?: string,
    @Ip() ip?: string,
    @Req() req?: Request,
  ): Promise<AuthResponseDto> {
    const userAgent = req?.headers['user-agent'] || 'unknown';
    const command = new RegisterCommand(
      dto.email,
      dto.providerId,
      dto.password,
      dto.programCategoryId,
      dto.providerUserId,
      dto.programId,
      dto.programSlug,
      dto.referralCode,
      ip || '0.0.0.0',
      userAgent,
    );
    return this.registerHandler.execute(command, url || brandDomain);
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
      dto.programCategoryId,
      dto.role,
      dto.additionalCategoryIds,
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
    @Query('url') url?: string,
    @Headers('x-brand-domain') brandDomain?: string,
    @Ip() ip?: string,
    @Req() req?: Request,
  ) {
    const userAgent = req?.headers['user-agent'] || 'unknown';
    const command = new ForgotPasswordCommand(dto.email, dto.programCategoryId, ip || '0.0.0.0', userAgent);
    return this.forgotPasswordHandler.execute(command, url || brandDomain);
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
    @Query('url') url?: string,
    @Headers('x-brand-domain') brandDomain?: string,
    @Ip() ip?: string,
    @Req() req?: Request,
  ) {
    const userAgent = req?.headers['user-agent'] || 'unknown';
    const command = new ResendVerificationEmailCommand(dto.email, dto.programCategoryId, ip || '0.0.0.0', userAgent);
    return this.resendVerificationEmailHandler.execute(command, url || brandDomain);
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

    const command = new LogoutCommand(user.userId, user.jti, user.exp);
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
    const query = new GetUserProfileQuery(user.userId, user.programCategoryId);
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
}
