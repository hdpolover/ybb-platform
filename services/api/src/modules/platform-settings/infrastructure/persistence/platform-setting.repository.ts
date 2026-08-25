// services/api/src/modules/platform-settings/infrastructure/persistence/platform-setting.repository.ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

export interface PlatformSettingRow {
  key: string;
  value: unknown;
  updatedAt: Date;
  updatedBy: string | null;
}

@Injectable()
export class PlatformSettingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async get(key: string): Promise<PlatformSettingRow | null> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key } });
    if (!row) return null;
    return { key: row.key, value: row.value, updatedAt: row.updatedAt, updatedBy: row.updatedBy };
  }

  async upsert(key: string, value: unknown, updatedBy: string | null): Promise<PlatformSettingRow> {
    const row = await this.prisma.platformSetting.upsert({
      where: { key },
      create: { key, value: value as Prisma.InputJsonValue, updatedBy },
      update: { value: value as Prisma.InputJsonValue, updatedBy },
    });
    return { key: row.key, value: row.value, updatedAt: row.updatedAt, updatedBy: row.updatedBy };
  }
}
