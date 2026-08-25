// services/api/src/modules/platform-settings/platform-settings.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { PlatformSettingRepository } from './infrastructure/persistence/platform-setting.repository';
import { ImpactStatsService } from './application/services/impact-stats.service';
import { PlatformSettingsController } from './presentation/platform-settings.controller';

@Module({
  // AuthModule is not @Global() — JwtAuthGuard/RolesGuard need it imported
  // here so their own DI dependencies (TokenBlacklistService, Reflector)
  // resolve for PlatformSettingsController (see brands.module.ts for the
  // same pattern on a controller guarded the same way).
  imports: [AuthModule],
  controllers: [PlatformSettingsController],
  providers: [PlatformSettingRepository, ImpactStatsService],
  exports: [PlatformSettingRepository],
})
export class PlatformSettingsModule {}
