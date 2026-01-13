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
import { AuthResponseDto } from './dto/auth-response.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { LoginHandler } from '../application/commands/handlers/login.handler';
import { RegisterHandler } from '../application/commands/handlers/register.handler';
import { RegisterAdminHandler } from '../application/commands/handlers/register-admin.handler';
import { LogoutHandler } from '../application/commands/handlers/logout.handler';
import { ForgotPasswordHandler } from '../application/commands/handlers/forgot-password.handler';
import { ResetPasswordHandler } from '../application/commands/handlers/reset-password.handler';
import { VerifyEmailHandler } from '../application/commands/handlers/verify-email.handler';
import { LoginCommand } from '../application/commands/login.command';
import { RegisterCommand } from '../application/commands/register.command';
import { RegisterAdminCommand } from '../application/commands/register-admin.command';
import { LogoutCommand } from '../application/commands/logout.command';
import { ForgotPasswordCommand } from '../application/commands/forgot-password.command';
import { ResetPasswordCommand } from '../application/commands/reset-password.command';
import { VerifyEmailCommand } from '../application/commands/verify-email.command';
import { Public } from '../../../shared/decorators/public.decorator';
import { CurrentUser, CurrentUserData } from '../../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../infrastructure/guards/jwt-auth.guard';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';

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
    private readonly prisma: PrismaService,
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
  ): Promise<AuthResponseDto> {
    const command = new RegisterCommand(
      dto.email,
      dto.password,
      dto.programCategoryId,
      dto.provider || 'local',
      dto.providerId,
      dto.programId,
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
  ) {
    const command = new ForgotPasswordCommand(dto.email, dto.programCategoryId);
    return this.forgotPasswordHandler.execute(command, url || brandDomain);
  }

  @Public()
  @Post('reset-password')
  @Throttle({ default: { limit: 3, ttl: 900000 } })
  @ApiOperation({ summary: 'Reset Password' })
  @ApiResponse({ status: 201, description: 'Password successfully reset' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    const command = new ResetPasswordCommand(dto.token, dto.password);
    return this.resetPasswordHandler.execute(command);
  }

  @Public()
  @Post('verify-email')
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Verify Email' })
  @ApiResponse({ status: 201, description: 'Email successfully verified' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    const command = new VerifyEmailCommand(dto.token);
    return this.verifyEmailHandler.execute(command);
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
    // Fetch fresh user data with identities and participant info
    const userData = await this.prisma.user.findUnique({
      where: { id: user.userId },
      include: {
        identities: {
          include: {
            provider: true
          }
        },
        participant: {
          include: {
            applications: {
              where: {
                program: {
                  programCategoryId: user.programCategoryId
                }
              },
              include: {
                program: true
              }
            }
          }
        }
      }
    });

    if (!userData) {
      return {
        userId: user.userId,
        email: user.email,
        programCategoryId: user.programCategoryId,
        identities: [],
        participantId: null,
        registeredPrograms: []
      };
    }

    const registeredPrograms = userData.participant?.applications.map(app => ({
      programId: app.programId,
      programName: app.program.name,
      programSlug: app.program.slug,
      year: app.program.year,
      applicationId: app.id,
      applicationStatus: app.status
    })) || [];

    return {
      userId: userData.id,
      email: userData.email,
      programCategoryId: userData.programCategoryId,
      identities: userData.identities.map(i => ({
        provider: i.provider.name,
        lastUsedAt: i.lastUsedAt
      })),
      participantId: userData.participant?.id,
      registeredPrograms
    };
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
    const providers = await this.prisma.authProvider.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        displayName: true,
        description: true,
        isOAuth: true,
        icon: true,
        buttonColor: true,
      },
      orderBy: { order: 'asc' },
    });

    return providers;
  }
}
