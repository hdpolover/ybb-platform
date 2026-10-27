import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LandingController } from './landing.controller';
import { LandingService } from './landing.service';
import { HomeStrategy } from './strategies/home.strategy';
import { AboutStrategy } from './strategies/about.strategy';
import { ProgramsStrategy } from './strategies/programs.strategy';
import { PartnersSponsorsStrategy } from './strategies/partners-sponsors.strategy';
import { AnnouncementsStrategy } from './strategies/announcements.strategy';
import { SettingsStrategy } from './strategies/settings.strategy';
import { FaqsStrategy } from './strategies/faqs.strategy';
import { ActivityStrategy } from './strategies/activity.strategy';
import { PaymentMethodsStrategy } from './strategies/payment-methods.strategy';
import { PaymentServiceHttpClient } from '../payments/infrastructure/services/payment-service-http.client';
import { LandingSnapshotService } from './services/landing-snapshot.service';
import { PlatformSettingsModule } from '@modules/platform-settings/platform-settings.module';

@Module({
  // PaymentsModule is NOT imported: it imports AuthModule, which would close
  // AuthModule -> MetaModule -> LandingModule -> PaymentsModule -> AuthModule
  // (see meta.module.ts). The plain HTTP client is provided here instead.
  imports: [
    PlatformSettingsModule,
    HttpModule.register({ timeout: 5000, maxRedirects: 0 }),
  ],
  controllers: [LandingController],
  providers: [
    LandingService,
    HomeStrategy,
    AboutStrategy,
    ProgramsStrategy,
    PartnersSponsorsStrategy,
    AnnouncementsStrategy,
    SettingsStrategy,
    FaqsStrategy,
    ActivityStrategy,
    PaymentMethodsStrategy,
    PaymentServiceHttpClient,
    LandingSnapshotService,
  ],
  exports: [LandingService],
})
export class LandingModule {}
