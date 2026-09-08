import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { ActiveOverride, ReadinessReport, ReadinessScope } from '../../domain/readiness-rule.types';

export interface SnapshotRow {
  subjectType: string;
  subjectId: string;
  brandId: string;
  subjectName: string;
  brandName: string | null;
  blockerCount: number;
  warningCount: number;
  unknownCount: number;
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
      // Newest first. evaluate-rules.ts's findOverride() no longer depends on
      // this for correctness (it explicitly prefers a non-expired match), but
      // an undefined return order from Postgres is still worth pinning down.
      orderBy: { createdAt: 'desc' },
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
    names: { subjectName: string; brandName?: string | null },
  ): Promise<void> {
    const payload = {
      brandId,
      subjectName: names.subjectName,
      brandName: names.brandName ?? null,
      result: report.results as unknown as object,
      blockerCount: report.blockerCount,
      warningCount: report.warningCount,
      unknownCount: report.unknownCount,
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

  // --- Alert baseline (ReadinessSnapshotService's nightly cron only) --------
  // Deliberately not backed by readiness_snapshots: that table is rewritten
  // on every readiness panel GET (see get-brand-readiness/get-program-
  // readiness handlers), so diffing against it let a viewed panel silently
  // reset what the alert considered "already known" (see IMPORTANT 6 in the
  // publish-readiness review).

  async getAlertBaseline(subjectType: ReadinessScope, subjectId: string): Promise<string[] | null> {
    const row = await this.read.readinessAlertBaseline.findUnique({
      where: { subjectType_subjectId: { subjectType, subjectId } },
      select: { blockerRuleIds: true },
    });
    return row ? (row.blockerRuleIds as unknown as string[]) : null;
  }

  async saveAlertBaseline(
    subjectType: ReadinessScope,
    subjectId: string,
    blockerRuleIds: string[],
  ): Promise<void> {
    const payload = { blockerRuleIds: blockerRuleIds as unknown as object, updatedAt: new Date() };
    await this.prisma.readinessAlertBaseline.upsert({
      where: { subjectType_subjectId: { subjectType, subjectId } },
      create: { subjectType, subjectId, ...payload },
      update: payload,
    });
  }
}
