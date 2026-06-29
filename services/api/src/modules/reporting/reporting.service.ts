import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ExcelService } from '@shared/infrastructure/excel/excel.service';
import { Response } from 'express';
import { PaymentStatus, Prisma } from '@prisma/client';
import { buildE164Phone } from '@shared/utils/phone-e164';

@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);
  private readonly exportBatchSize = 500;

  constructor(
    private readonly prisma: PrismaService,
    private readonly excelService: ExcelService,
  ) { }

  async exportAuditLogs(res: Response) {
    const columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Timestamp', key: 'timestamp', width: 20 },
      { header: 'Action', key: 'action', width: 15 },
      { header: 'Entity Type', key: 'entityType', width: 25 },
      { header: 'Entity ID', key: 'entityId', width: 36 },
      { header: 'Event', key: 'event', width: 30 },
      { header: 'Actor Type', key: 'actorType', width: 12 },
      { header: 'Actor ID', key: 'actorId', width: 36 },
      { header: 'Risk Level', key: 'riskLevel', width: 12 },
      { header: 'Source', key: 'source', width: 12 },
      { header: 'Endpoint', key: 'endpoint', width: 40 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Changed Fields', key: 'changedFields', width: 30 },
      { header: 'Before State', key: 'beforeState', width: 50 },
      { header: 'After State', key: 'afterState', width: 50 },
      { header: 'IP Address', key: 'ip', width: 15 },
    ];

    await this.excelService.streamExcelRows(
      res,
      this.iterateAuditLogRows(),
      columns,
      'audit-logs',
    );
  }

  async exportUsers(res: Response) {
    const columns = [
      { header: 'User ID', key: 'id', width: 36 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Active', key: 'isActive', width: 10 },
      { header: 'Verified', key: 'isVerified', width: 10 },
      { header: 'Created At', key: 'createdAt', width: 20 },
      { header: 'Last Login', key: 'lastLogin', width: 20 },
      { header: 'Brand ID', key: 'brandId', width: 36 },
      { header: 'Providers', key: 'providers', width: 20 },
    ];

    await this.excelService.streamExcelRows(
      res,
      this.iterateUserRows(),
      columns,
      'users-export',
    );
  }

  async exportParticipants(res: Response) {
    const columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Full Name', key: 'fullName', width: 30 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 20 },
      { header: 'Nationality', key: 'nationality', width: 20 },
      { header: 'Institution', key: 'institution', width: 30 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Created At', key: 'createdAt', width: 20 },
    ];

    await this.excelService.streamExcelRows(
      res,
      this.iterateParticipantRows(),
      columns,
      'participants-export',
    );
  }

  async exportPayments(res: Response, filters?: { programId?: string; status?: string; search?: string }) {
    const columns = [
      { header: 'Invoice ID', key: 'id', width: 36 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Currency', key: 'currency', width: 10 },
      { header: 'Program', key: 'program', width: 30 },
      { header: 'Payer Email', key: 'payerEmail', width: 30 },
      { header: 'Payer Phone', key: 'payerPhone', width: 20 },
      { header: 'Price Tier', key: 'tier', width: 20 },
      { header: 'Method', key: 'method', width: 15 },
      { header: 'Paid At', key: 'paidAt', width: 20 },
      { header: 'Ext Tx ID', key: 'extId', width: 30 },
    ];

    await this.excelService.streamExcelRows(
      res,
      this.iteratePaymentRows(filters),
      columns,
      'payments-export',
    );
  }

  private async *iterateAuditLogRows() {
    let cursor: { id: string; createdAt: Date } | null = null;

    while (true) {
      const logs = await this.prisma.dataChangeLog.findMany({
        where: this.buildCreatedAtCursorWhere(cursor),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: this.exportBatchSize,
      });
      if (logs.length === 0) return;

      for (const log of logs) {
        yield {
          id: log.id,
          timestamp: log.createdAt,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId || '',
          event: log.event || '',
          actorType: log.actorType,
          actorId: log.actorId || '',
          riskLevel: log.riskLevel,
          source: log.source || '',
          endpoint: log.endpoint || '',
          status: log.status,
          changedFields: (log.changedFields || []).join(', '),
          beforeState: log.beforeState ? JSON.stringify(log.beforeState) : '',
          afterState: log.afterState ? JSON.stringify(log.afterState) : '',
          ip: log.ipAddress,
        };
      }

      const last = logs[logs.length - 1];
      cursor = { id: last.id, createdAt: last.createdAt };
    }
  }

  private async *iterateUserRows() {
    let cursor: { id: string; createdAt: Date } | null = null;

    while (true) {
      const users = await this.prisma.user.findMany({
        where: this.buildCreatedAtCursorWhere(cursor),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { identities: true },
        take: this.exportBatchSize,
      });
      if (users.length === 0) return;

      for (const user of users) {
        yield {
          id: user.id,
          email: user.email,
          isActive: user.isActive ? 'Yes' : 'No',
          isVerified: user.emailVerified ? 'Yes' : 'No',
          createdAt: user.createdAt,
          lastLogin: user.lastLoginAt,
          brandId: user.brandId,
          providers: user.identities
            .map((i: { providerId?: string }) => i.providerId)
            .join(', '),
        };
      }

      const last = users[users.length - 1];
      cursor = { id: last.id, createdAt: last.createdAt };
    }
  }

  private async *iterateParticipantRows() {
    let cursor: { id: string; createdAt: Date } | null = null;

    while (true) {
      const participants = await this.prisma.participant.findMany({
        where: this.buildCreatedAtCursorWhere(cursor),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          user: { select: { email: true } },
        },
        take: this.exportBatchSize,
      });
      if (participants.length === 0) return;

      for (const participant of participants) {
        yield {
          id: participant.id,
          fullName: participant.fullName,
          email: participant.user?.email || 'N/A',
          phone: buildE164Phone(participant.phoneCountryCode, participant.phoneNumber),
          nationality: participant.nationality,
          institution: participant.institution,
          status: participant.deletedAt ? 'Deleted' : 'Active',
          createdAt: participant.createdAt,
        };
      }

      const last = participants[participants.length - 1];
      cursor = { id: last.id, createdAt: last.createdAt };
    }
  }

  private async *iteratePaymentRows(filters?: { programId?: string; status?: string; search?: string }) {
    let cursor: { id: string; createdAt: Date } | null = null;

    while (true) {
      const cursorWhere = this.buildCreatedAtCursorWhere(cursor);

      const filterConditions: Prisma.ApplicationInvoiceWhereInput[] = [];

      if (filters?.programId) {
        filterConditions.push({ application: { is: { programId: filters.programId } } });
      }

      if (filters?.status) {
        filterConditions.push({ status: filters.status as PaymentStatus });
      }

      if (filters?.search) {
        const keyword = filters.search.trim();
        if (keyword) {
          filterConditions.push({
            OR: [
              { externalTransactionId: { contains: keyword, mode: 'insensitive' } },
              {
                application: {
                  is: {
                    participant: {
                      is: {
                        user: {
                          is: {
                            email: { contains: keyword, mode: 'insensitive' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
          });
        }
      }

      const where: Prisma.ApplicationInvoiceWhereInput =
        filterConditions.length > 0
          ? { AND: [cursorWhere ?? {}, ...filterConditions] }
          : (cursorWhere ?? {});

      const invoices = await this.prisma.applicationInvoice.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          pricingTier: { select: { name: true } },
          application: {
            include: {
              program: { select: { name: true } },
              participant: {
                include: {
                  user: { select: { email: true } },
                },
              },
            },
          },
        },
        take: this.exportBatchSize,
      });
      if (invoices.length === 0) return;

      for (const invoice of invoices) {
        yield {
          id: invoice.id,
          status: invoice.status,
          amount: invoice.amount ? invoice.amount.toString() : '0',
          currency: invoice.currency,
          program: invoice.application?.program?.name ?? 'Unknown',
          payerEmail: invoice.application?.participant?.user?.email ?? 'N/A',
          payerPhone:
            buildE164Phone(
              invoice.application?.participant?.phoneCountryCode,
              invoice.application?.participant?.phoneNumber,
            ) ?? '-',
          tier: invoice.pricingTier?.name ?? 'N/A',
          method: invoice.paymentMethod || '-',
          paidAt: invoice.paidAt ? new Date(invoice.paidAt).toISOString() : '-',
          extId: invoice.externalTransactionId || '-',
        };
      }

      const last = invoices[invoices.length - 1];
      cursor = { id: last.id, createdAt: last.createdAt };
    }
  }

  private buildCreatedAtCursorWhere(
    cursor: { id: string; createdAt: Date } | null,
  ) {
    if (!cursor) return undefined;

    return {
      OR: [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
      ],
    };
  }
}
