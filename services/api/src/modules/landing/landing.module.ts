import { Module } from '@nestjs/common';
import { LandingController } from './landing.controller';
import { LandingService } from './landing.service';
import { HomeStrategy } from './strategies/home.strategy';
import { AboutStrategy } from './strategies/about.strategy';
import { ProgramsStrategy } from './strategies/programs.strategy';
import { PartnersSponsorsStrategy } from './strategies/partners-sponsors.strategy';
import { AnnouncementsStrategy } from './strategies/announcements.strategy';
import { SettingsStrategy } from './strategies/settings.strategy';
import { FaqsStrategy } from './strategies/faqs.strategy';
import { LandingSnapshotService } from './services/landing-snapshot.service';

@Module({
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
    LandingSnapshotService,
  ],
  exports: [LandingService],
})
export class LandingModule {}
