// services/api/src/modules/platform-settings/platform-settings.module.ts
import { Module } from '@nestjs/common';
import { PlatformSettingRepository } from './infrastructure/persistence/platform-setting.repository';

@Module({
  providers: [PlatformSettingRepository],
  exports: [PlatformSettingRepository],
})
export class PlatformSettingsModule {}
