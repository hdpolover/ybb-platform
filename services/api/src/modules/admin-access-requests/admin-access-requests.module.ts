// services/api/src/modules/admin-access-requests/admin-access-requests.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TurnstileModule } from '@shared/infrastructure/turnstile/turnstile.module';
import { AuthModule } from '../auth/auth.module';
import { AdminsModule } from '../admins/admins.module';
import { AdminAccessRequestsService } from './admin-access-requests.service';
import { AdminAccessRequestsController } from './admin-access-requests.controller';
import { AdminAccessRequestsPublicController } from './admin-access-requests-public.controller';

@Module({
  imports: [
    AuthModule,
    AdminsModule,
    TurnstileModule,
    ConfigModule,
    // TurnstileGuard verifies admin bearer tokens with JwtService (same secret as AuthModule).
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.get<string>('JWT_SECRET') }),
    }),
  ],
  controllers: [AdminAccessRequestsPublicController, AdminAccessRequestsController],
  providers: [AdminAccessRequestsService],
})
export class AdminAccessRequestsModule {}
