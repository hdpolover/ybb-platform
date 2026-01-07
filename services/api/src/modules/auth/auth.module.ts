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
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { JwtAuthGuard } from './infrastructure/guards/jwt-auth.guard';
import { TokenBlacklistService } from './infrastructure/services/token-blacklist.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

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
    ClientsModule.register([
      {
        name: 'NOTIFICATION_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672/'],
          queue: 'notification_queue',
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    PrismaService,
    LoginHandler,
    RegisterHandler,
    RegisterAdminHandler,
    LogoutHandler,
    ForgotPasswordHandler,
    ResetPasswordHandler,
    VerifyEmailHandler,
    JwtStrategy,
    JwtAuthGuard,
    TokenBlacklistService,
  ],
  exports: [JwtAuthGuard, JwtStrategy, TokenBlacklistService, PassportModule],
})
export class AuthModule { }

