// services/api/src/modules/platform-settings/platform-settings.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from '@modules/auth/auth.module';
import { LandingRevalidationService } from '@modules/brands/application/services/landing-revalidation.service';
import { LandingCacheInvalidationService } from '@modules/brands/application/services/landing-cache-invalidation.service';
import { PlatformSettingRepository } from './infrastructure/persistence/platform-setting.repository';
import { ImpactStatsService } from './application/services/impact-stats.service';
import { PlatformSettingsController } from './presentation/platform-settings.controller';

@Module({
  // AuthModule is not @Global() — JwtAuthGuard/RolesGuard need it imported
  // here so their own DI dependencies (TokenBlacklistService, Reflector)
  // resolve for PlatformSettingsController (see brands.module.ts for the
  // same pattern on a controller guarded the same way).
  //
  // HttpModule is required (not global) because LandingCacheInvalidationService
  // depends on LandingRevalidationService, which POSTs to the landing app's
  // revalidate routes via HttpService. BrandsModule can't be imported directly
  // to get these services — it imports ProgramsModule, and ProgramsModule
  // already re-declares these same classes as local providers rather than
  // risk a cycle; gallery.module.ts follows the same convention, matched here.
  imports: [AuthModule, HttpModule],
  controllers: [PlatformSettingsController],
  providers: [PlatformSettingRepository, ImpactStatsService, LandingRevalidationService, LandingCacheInvalidationService],
  exports: [PlatformSettingRepository],
})
export class PlatformSettingsModule {}
