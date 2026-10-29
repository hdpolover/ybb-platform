// src/modules/brand-email/brand-email.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { BrandEmailController } from './brand-email.controller';
import { BrandEmailService } from './brand-email.service';
import { ListmonkClient } from './listmonk.client';

// AuthModule is required: the controller uses JwtAuthGuard/RolesGuard, and
// unit tests stub guards so a missing import only shows up as a boot crash.
@Module({
    imports: [ConfigModule, AuthModule],
    controllers: [BrandEmailController],
    providers: [BrandEmailService, ListmonkClient],
})
export class BrandEmailModule {}
