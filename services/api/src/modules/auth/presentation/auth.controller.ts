import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginHandler } from '../application/commands/handlers/login.handler';
import { RegisterHandler } from '../application/commands/handlers/register.handler';
import { LoginCommand } from '../application/commands/login.command';
import { RegisterCommand } from '../application/commands/register.command';
import { Public } from '../../../shared/decorators/public.decorator';
import { CurrentUser, CurrentUserData } from '../../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../infrastructure/guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginHandler: LoginHandler,
    private readonly registerHandler: RegisterHandler,
  ) {}

  @Public()
  @Post('login')
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
  @ApiOperation({ summary: 'User registration' })
  async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    const command = new RegisterCommand(
      dto.email,
      dto.password,
      dto.programCategoryId,
    );
    return this.registerHandler.execute(command);
  }

  @Get('me')
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
