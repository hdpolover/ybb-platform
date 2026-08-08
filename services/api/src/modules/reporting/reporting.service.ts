import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { ExcelService } from '@shared/infrastructure/excel/excel.service';
import { Response } from 'express';
import { ApplicationCategory, Prisma } from '@prisma/client';
import {
  buildE164Phone,
  extractPhoneFromPersonalData,
  sanitizePhone,
} from '@shared/utils/phone-e164';
import {
  buildInvoiceWhere,
  obsoleteRegistrationFeeInvoiceIdsSql,
  InvoiceFilterQuery,
} from '@modules/payments/application/services/invoice-where.builder';
import { coalesceStr } from '../applications/application/helpers/application-coalesce.helpers';
import { resolveCountryName } from '@shared/utils/country-groups';

@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);
  private readonly exportBatchSize = 500;

  constructor(
    private readonly prisma: PrismaService,
    private readonly readPrisma: PrismaReadService,
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
      { header: 'Phone Valid', key: 'phoneValid', width: 12 },
      { header: 'Nationality', key: 'nationality', width: 20 },
      { header: 'Institution', key: 'institution', width: 30 },
      { header: 'Occupation', key: 'occupation', width: 24 },
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

  async exportPayments(res: Response, filters?: InvoiceFilterQuery) {
    const columns = [
      // Identifiers
      { header: 'Invoice ID', key: 'id', width: 36 },
      { header: 'Application ID', key: 'applicationId', width: 36 },
      // Who / what
      { header: 'Participant Name', key: 'participantName', width: 30 },
      { header: 'Payer Email', key: 'payerEmail', width: 30 },
      { header: 'Payer Phone', key: 'payerPhone', width: 20 },
      { header: 'Phone Valid', key: 'phoneValid', width: 12 },
      { header: 'Country', key: 'country', width: 10 },
      { header: 'Institution', key: 'institution', width: 28 },
      { header: 'Occupation', key: 'occupation', width: 24 },
      { header: 'Program', key: 'program', width: 30 },
      { header: 'Application Category', key: 'applicationCategory', width: 18 },
      { header: 'Price Tier', key: 'tier', width: 20 },
      // Money
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Currency', key: 'currency', width: 10 },
      // Status / dates
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Method', key: 'method', width: 15 },
      { header: 'Created At', key: 'createdAt', width: 20 },
      { header: 'Paid At', key: 'paidAt', width: 20 },
      // Technical ids
      { header: 'Ext Tx ID', key: 'extId', width: 30 },
    ];

    // Mirrors PaymentAdminController.listInvoices: exclude obsolete
    // registration_fee invoices so the export matches what the admin table
    // shows. Only meaningful (and only runs) when scoped to a program — an
    // export with no programId has no program to resolve pricing tiers
    // against, same as the list endpoint, which requires programId.
    const obsoleteInvoiceIds = filters?.programId
      ? (
        await this.readPrisma.$queryRaw<{ id: string }[]>(
          obsoleteRegistrationFeeInvoiceIdsSql(filters.programId),
        )
      ).map((r) => r.id)
      : [];

    await this.excelService.streamExcelRows(
      res,
      this.iteratePaymentRows(filters, obsoleteInvoiceIds),
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
          applications: {
            select: { personalData: true },
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
        take: this.exportBatchSize,
      });
      if (participants.length === 0) return;

      for (const participant of participants) {
        // Find the first application that actually carries a phone in its
        // personal_data — its `nationality` key is the best region hint for
        // sanitizing that specific phone value.
        const applicationWithPhone = participant.applications.find((application) =>
          extractPhoneFromPersonalData(application.personalData),
        );

        const rawPhone = applicationWithPhone
          ? extractPhoneFromPersonalData(applicationWithPhone.personalData)
          : buildE164Phone(participant.phoneCountryCode, participant.phoneNumber);

        const regionHint =
          this.readNationality(applicationWithPhone?.personalData) ??
          participant.nationality ??
          undefined;

        const { value: phone, isValid: phoneValid } = sanitizePhone(rawPhone, regionHint);

        // `participants.institution`/`occupation`/`nationality` are dead
        // columns: onboarding never writes them, the real values live in the
        // application's personal_data JSON. Read the first application that
        // actually has each one; fall back to the dead column only for
        // legacy rows that predate this.
        const institution =
          this.readPersonalDataField(participant.applications, 'institution') ?? participant.institution;
        const occupation =
          this.readPersonalDataField(participant.applications, 'occupation') ?? participant.occupation;
        const nationality =
          resolveCountryName(
            participant.originCountry,
            this.readPersonalDataField(participant.applications, 'nationality'),
          ) ?? 'N/A';

        yield {
          id: participant.id,
          fullName: participant.fullName,
          email: participant.user?.email || 'N/A',
          phone,
          phoneValid: phone === '-' ? '—' : phoneValid ? 'Yes' : 'No',
          nationality,
          institution,
          occupation,
          status: participant.deletedAt ? 'Deleted' : 'Active',
          createdAt: participant.createdAt,
        };
      }

      const last = participants[participants.length - 1];
      cursor = { id: last.id, createdAt: last.createdAt };
    }
  }

  private async *iteratePaymentRows(
    filters?: InvoiceFilterQuery,
    obsoleteInvoiceIds: string[] = [],
  ) {
    let cursor: { id: string; createdAt: Date } | null = null;

    // Single source of truth shared with PaymentAdminController.listInvoices —
    // see invoice-where.builder.ts. Computed once; only the cursor window
    // changes per page.
    const invoiceWhere = buildInvoiceWhere(filters ?? {}, obsoleteInvoiceIds);

    while (true) {
      const cursorWhere = this.buildCreatedAtCursorWhere(cursor);
      const where: Prisma.ApplicationInvoiceWhereInput = cursorWhere
        ? { AND: [cursorWhere, invoiceWhere] }
        : invoiceWhere;

      const invoices = await this.readPrisma.applicationInvoice.findMany({
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
        const rawPhone =
          extractPhoneFromPersonalData(invoice.application?.personalData) ??
          buildE164Phone(
            invoice.application?.participant?.phoneCountryCode,
            invoice.application?.participant?.phoneNumber,
          );

        const regionHint =
          this.readNationality(invoice.application?.personalData) ??
          invoice.application?.participant?.nationality ??
          undefined;

        const { value: payerPhone, isValid: phoneValid } = sanitizePhone(rawPhone, regionHint);

        // Same JSON-first / dead-column-fallback pattern as the applications
        // export: personal_data is the real source, participant columns are
        // legacy fallbacks that are empty for nearly all prod rows.
        const personalData = (invoice.application?.personalData ?? {}) as Record<string, unknown>;
        const institution =
          coalesceStr(personalData['institution']) ?? invoice.application?.participant?.institution ?? '';
        const occupation =
          coalesceStr(personalData['occupation']) ?? invoice.application?.participant?.occupation ?? '';
        const country =
          resolveCountryName(
            invoice.application?.participant?.originCountry,
            this.readNationality(invoice.application?.personalData),
          ) ?? 'N/A';

        yield {
          id: invoice.id,
          applicationId: invoice.applicationId,
          participantName: invoice.application?.participant?.fullName ?? 'N/A',
          payerEmail: invoice.application?.participant?.user?.email ?? 'N/A',
          payerPhone,
          phoneValid: payerPhone === '-' ? '-' : phoneValid ? 'Yes' : 'No',
          country,
          institution,
          occupation,
          program: invoice.application?.program?.name ?? 'Unknown',
          applicationCategory: this.humanizeApplicationCategory(
            invoice.application?.applicationCategory,
          ),
          tier: invoice.pricingTier?.name ?? 'N/A',
          amount: invoice.amount ? invoice.amount.toString() : '0',
          currency: invoice.currency,
          status: invoice.status,
          method: invoice.paymentMethod || '-',
          createdAt: invoice.createdAt ? new Date(invoice.createdAt).toISOString() : '-',
          paidAt: invoice.paidAt ? new Date(invoice.paidAt).toISOString() : '-',
          extId: invoice.externalTransactionId || '-',
        };
      }

      const last = invoices[invoices.length - 1];
      cursor = { id: last.id, createdAt: last.createdAt };
    }
  }

  /** Humanises the funding category enum for a human-readable export column. */
  private humanizeApplicationCategory(
    category: ApplicationCategory | null | undefined,
  ): string {
    switch (category) {
      case ApplicationCategory.fully_funded:
        return 'Fully Funded';
      case ApplicationCategory.self_funded:
        return 'Self Funded';
      default:
        return 'N/A';
    }
  }

  /** Read the `nationality` (ISO-3166 alpha-2) region hint out of a personal_data JSON blob. */
  private readNationality(personalData: unknown): string | undefined {
    if (!personalData || typeof personalData !== 'object') return undefined;
    const nationality = (personalData as Record<string, unknown>).nationality;
    return typeof nationality === 'string' ? nationality : undefined;
  }

  /**
   * Read a personal_data field out of the first application (most recent
   * first) that actually carries a non-empty value for it. Institution,
   * occupation, and nationality have not been observed to vary in key name
   * across programs, so a single key lookup is sufficient here.
   */
  private readPersonalDataField(
    applications: { personalData: unknown }[],
    field: string,
  ): string | undefined {
    for (const application of applications) {
      const personalData = application.personalData;
      if (!personalData || typeof personalData !== 'object') continue;
      const value = (personalData as Record<string, unknown>)[field];
      if (typeof value === 'string' && value.trim() !== '') return value;
    }
    return undefined;
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
