import { Controller, Post, Body, Get, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginHandler } from '../application/commands/handlers/login.handler';
import { RegisterHandler } from '../application/commands/handlers/register.handler';
import { LogoutHandler } from '../application/commands/handlers/logout.handler';
import { ForgotPasswordHandler } from '../application/commands/handlers/forgot-password.handler';
import { LoginCommand } from '../application/commands/login.command';
import { RegisterCommand } from '../application/commands/register.command';
import { LogoutCommand } from '../application/commands/logout.command';
import { ForgotPasswordCommand } from '../application/commands/forgot-password.command';
import { Public } from '../../../shared/decorators/public.decorator';
import { CurrentUser, CurrentUserData } from '../../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../infrastructure/guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginHandler: LoginHandler,
    private readonly registerHandler: RegisterHandler,
    private readonly logoutHandler: LogoutHandler,
    private readonly forgotPasswordHandler: ForgotPasswordHandler,
  ) { }

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 attempts per 15 minutes
  @ApiOperation({ summary: 'User login' })
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    const command = new LoginCommand(
      dto.email,
      dto.password,
      dto.programCategoryId,
    );
    return this.loginHandler.execute(command);
  }

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 attempts per hour
  @ApiOperation({ summary: 'User registration' })
  async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    const command = new RegisterCommand(
      dto.email,
      dto.password,
      dto.programCategoryId,
    );
    return this.registerHandler.execute(command);
  }

  @Public()
  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @ApiOperation({ summary: 'Request password reset' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const command = new ForgotPasswordCommand(dto.email, dto.programCategoryId);
    return this.forgotPasswordHandler.execute(command);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'User logout - invalidates current token' })
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
  @ApiOperation({ summary: 'Get current user info' })
  async getProfile(@CurrentUser() user: CurrentUserData) {
    return {
      userId: user.userId,
      email: user.email,
      programCategoryId: user.programCategoryId,
    };
  }
}
