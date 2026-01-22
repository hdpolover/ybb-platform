import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './presentation/auth.controller';
import { LoginHandler } from './application/commands/handlers/login.handler';
import { RegisterHandler } from './application/commands/handlers/register.handler';
import { RegisterAdminHandler } from './application/commands/handlers/register-admin.handler';
import { LogoutHandler } from './application/commands/handlers/logout.handler';
import { ForgotPasswordHandler } from './application/commands/handlers/forgot-password.handler';
import { ResetPasswordHandler } from './application/commands/handlers/reset-password.handler';
import { VerifyEmailHandler } from './application/commands/handlers/verify-email.handler';
import { ResendVerificationEmailHandler } from './application/commands/handlers/resend-verification-email.handler';
import { GetUserProfileHandler } from './application/queries/handlers/get-user-profile.handler';
import { GetAuthProvidersHandler } from './application/queries/handlers/get-auth-providers.handler';
import { CreateAuthProviderHandler } from './application/commands/handlers/create-auth-provider.handler';
import { UpdateAuthProviderHandler } from './application/commands/handlers/update-auth-provider.handler';
import { DeleteAuthProviderHandler } from './application/commands/handlers/delete-auth-provider.handler';
import { AuthProviderController } from './presentation/auth-provider.controller';
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { JwtAuthGuard } from './infrastructure/guards/jwt-auth.guard';
import { TokenBlacklistService } from './infrastructure/services/token-blacklist.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { AuthLoggingService } from './application/services/auth-logging.service';
import { GeoIpModule } from '@shared/infrastructure/geoip/geoip.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '1h'),
        },
      }),
      inject: [ConfigService],
    }),
    GeoIpModule,
  ],
  controllers: [AuthController, AuthProviderController],
  providers: [
    PrismaService,
    LoginHandler,
    RegisterHandler,
    RegisterAdminHandler,
    LogoutHandler,
    ForgotPasswordHandler,
    ResetPasswordHandler,
    VerifyEmailHandler,
    ResendVerificationEmailHandler,
    GetUserProfileHandler,
    GetAuthProvidersHandler,
    CreateAuthProviderHandler,
    UpdateAuthProviderHandler,
    DeleteAuthProviderHandler,
    JwtStrategy,
    JwtAuthGuard,
    TokenBlacklistService,
    AuthLoggingService,
  ],
  exports: [JwtAuthGuard, JwtStrategy, TokenBlacklistService, PassportModule],
})
export class AuthModule { }

