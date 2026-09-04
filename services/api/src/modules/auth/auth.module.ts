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
import { FirebaseLoginHandler } from './application/commands/handlers/firebase-login.handler';
import { LinkLocalIdentityHandler } from './application/commands/handlers/link-local-identity.handler';
import { AdminLoginHandler } from './application/commands/handlers/admin-login.handler';
import { AdminRefreshHandler } from './application/commands/handlers/admin-refresh.handler';
import { AmbassadorLoginHandler } from './application/commands/handlers/ambassador-login.handler';
import { GetUserProfileHandler } from './application/queries/handlers/get-user-profile.handler';
import { GetAuthProvidersHandler } from './application/queries/handlers/get-auth-providers.handler';
import { GetAuthContextHandler } from './application/queries/handlers/get-auth-context.handler';
import { CreateAuthProviderHandler } from './application/commands/handlers/create-auth-provider.handler';
import { UpdateAuthProviderHandler } from './application/commands/handlers/update-auth-provider.handler';
import { DeleteAuthProviderHandler } from './application/commands/handlers/delete-auth-provider.handler';
import { AuthProviderController } from './presentation/auth-provider.controller';
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { JwtAuthGuard } from './infrastructure/guards/jwt-auth.guard';
import { TokenBlacklistService } from './infrastructure/services/token-blacklist.service';
import { FirebaseAuthService } from './infrastructure/services/firebase-auth.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { AuthLoggingService } from './application/services/auth-logging.service';
import { GeoIpModule } from '@shared/infrastructure/geoip/geoip.module';
import { MonitoringModule } from '@shared/infrastructure/monitoring/monitoring.module';

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
    MonitoringModule,
  ],
  controllers: [AuthController, AuthProviderController],
  providers: [
    LoginHandler,
    RegisterHandler,
    RegisterAdminHandler,
    LogoutHandler,
    ForgotPasswordHandler,
    ResetPasswordHandler,
    VerifyEmailHandler,
    ResendVerificationEmailHandler,
    FirebaseLoginHandler,
    LinkLocalIdentityHandler,
    AdminLoginHandler,
    AdminRefreshHandler,
    AmbassadorLoginHandler,
    GetUserProfileHandler,
    GetAuthProvidersHandler,
    GetAuthContextHandler,
    CreateAuthProviderHandler,
    UpdateAuthProviderHandler,
    DeleteAuthProviderHandler,
    JwtStrategy,
    JwtAuthGuard,
    TokenBlacklistService,
    FirebaseAuthService,
    AuthLoggingService,
  ],
  exports: [JwtAuthGuard, JwtStrategy, TokenBlacklistService, PassportModule, FirebaseAuthService],
})
export class AuthModule { }

