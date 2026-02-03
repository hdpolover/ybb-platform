import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ExcelService } from '@shared/infrastructure/excel/excel.service';
import { Response } from 'express';

@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly excelService: ExcelService,
  ) {}

  async exportAuditLogs(res: Response) {
    // @ts-ignore
    const logs = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const data = logs.map((log: any) => ({
      id: log.id,
      timestamp: log.createdAt,
      event: log.event,
      entity: `${log.entityType || ''}:${log.entityId || ''}`,
      actor: log.actorId,
      status: log.status,
      ip: log.ipAddress,
      details: JSON.stringify(log.payload)
    }));

    const columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Timestamp', key: 'timestamp', width: 20 },
      { header: 'Event', key: 'event', width: 30 },
      { header: 'Entity', key: 'entity', width: 30 },
      { header: 'Actor ID', key: 'actor', width: 36 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'IP Address', key: 'ip', width: 15 },
      { header: 'Details', key: 'details', width: 50 },
    ];

    await this.excelService.streamExcel(res, data, columns, 'audit-logs');
  }

  async exportUsers(res: Response) {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        identities: true
      },
      take: 2000 // Limit for safety
    });

    const data = users.map(user => ({
      id: user.id,
      email: user.email,
      isActive: user.isActive ? 'Yes' : 'No',
      isVerified: user.emailVerified ? 'Yes' : 'No',
      createdAt: user.createdAt,
      lastLogin: user.lastLoginAt,
      brandId: user.brandId,
      providers: user.identities.map((i: any) => i.providerId).join(', ')
    }));

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

    await this.excelService.streamExcel(res, data, columns, 'users-export');
  }

  async exportParticipants(res: Response) {
    const participants = await this.prisma.participant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { email: true } }
      },
      take: 2000
    });

    const data = participants.map(p => ({
      id: p.id,
      fullName: p.fullName,
      email: p.user?.email || 'N/A',
      phone: p.phoneNumber,
      nationality: p.nationality,
      institution: p.institution,
      status: p.deletedAt ? 'Deleted' : 'Active',
      createdAt: p.createdAt
    }));

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

    await this.excelService.streamExcel(res, data, columns, 'participants-export');
  }

  async exportPayments(res: Response) {
    const invoices = await this.prisma.applicationInvoice.findMany({
      orderBy: { createdAt: 'desc' },
      take: 2000,
      include: {
        pricingTier: { select: { name: true } },
        application: {
          include: {
            // @ts-ignore
            program: { select: { title: true } },
            participant: {
              include: {
                user: { select: { email: true } }
              }
            }
          }
        }
      }
    });

    const data = invoices.map((inv: any) => ({
      id: inv.id,
      status: inv.status,
      // @ts-ignore
      amount: inv.amount ? inv.amount.toString() : '0',
      currency: inv.currency,
      // @ts-ignore
      program: inv.application?.program?.title ?? 'Unknown',
      payerEmail: inv.application?.participant?.user?.email ?? 'N/A',
      tier: inv.pricingTier?.name ?? 'N/A',
      method: inv.paymentMethod || '-',
      paidAt: inv.paidAt || '-',
      extId: inv.externalTransactionId || '-'
    }));

    const columns = [
      { header: 'Invoice ID', key: 'id', width: 36 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Currency', key: 'currency', width: 10 },
      { header: 'Program', key: 'program', width: 30 },
      { header: 'Payer Email', key: 'payerEmail', width: 30 },
      { header: 'Price Tier', key: 'tier', width: 20 },
      { header: 'Method', key: 'method', width: 15 },
      { header: 'Paid At', key: 'paidAt', width: 20 },
      { header: 'Ext Tx ID', key: 'extId', width: 30 },
    ];

    await this.excelService.streamExcel(res, data, columns, 'payments-export');
  }
}
