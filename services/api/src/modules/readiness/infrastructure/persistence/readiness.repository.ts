import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { ActiveOverride, ReadinessReport, ReadinessScope } from '../../domain/readiness-rule.types';

export interface SnapshotRow {
  subjectType: string;
  subjectId: string;
  brandId: string;
  blockerCount: number;
  warningCount: number;
  evaluatedAt: Date;
  result: unknown;
}

@Injectable()
export class ReadinessRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly read: PrismaReadService,
  ) {}

  async findActiveOverrides(subjectType: ReadinessScope, subjectId: string): Promise<ActiveOverride[]> {
    const rows = await this.read.readinessOverride.findMany({
      where: { subjectType, subjectId, revokedAt: null, deletedAt: null },
      select: { ruleId: true, reason: true, adminId: true, expiresAt: true },
    });
    return rows as ActiveOverride[];
  }

  async createOverride(input: {
    subjectType: ReadinessScope;
    subjectId: string;
    ruleId: string;
    adminId: string;
    reason: string;
    expiresAt: Date | null;
  }): Promise<void> {
    await this.prisma.readinessOverride.create({ data: input });
  }

  async saveSnapshot(
    subjectType: ReadinessScope,
    subjectId: string,
    brandId: string,
    report: ReadinessReport,
  ): Promise<void> {
    const payload = {
      brandId,
      result: report.results as unknown as object,
      blockerCount: report.blockerCount,
      warningCount: report.warningCount,
      evaluatedAt: report.evaluatedAt,
    };
    await this.prisma.readinessSnapshot.upsert({
      where: { subjectType_subjectId: { subjectType, subjectId } },
      create: { subjectType, subjectId, ...payload },
      update: payload,
    });
  }

  async findSnapshots(subjectType?: ReadinessScope): Promise<SnapshotRow[]> {
    return this.read.readinessSnapshot.findMany({
      where: subjectType ? { subjectType } : {},
      orderBy: [{ blockerCount: 'desc' }, { warningCount: 'desc' }],
    }) as unknown as Promise<SnapshotRow[]>;
  }
}
