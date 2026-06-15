import {
    Controller,
    Get,
    Post,
    Patch,
    Put,
    Delete,
    Body,
    Param,
    UseGuards,
    Query,
    HttpException,
    BadRequestException,
    Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from './dto/admin-payment-method.dto';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';
import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';
import { AuditTrail } from '@shared/decorators/audit-trail.decorator';
import { ChangeType, PaymentStatus, Prisma } from '@prisma/client';

import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@shared/constants/cache-keys';
import { PaymentServiceHttpClient } from '../infrastructure/services/payment-service-http.client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { buildParticipantPaymentsUrl as buildParticipantPaymentsDashboardUrl } from '@modules/payments/application/utils/participant-dashboard-url.util';

@ApiTags('Admin Payments')
@Controller('admin/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class PaymentAdminController {
    private static readonly PARTICIPANT_CANCELLATION_REASON = 'Cancelled by participant';
    private readonly paymentServiceInternalKey: string;
    private readonly logger = new Logger(PaymentAdminController.name);

    constructor(
        private readonly paymentServiceClient: PaymentServiceHttpClient,
        private readonly configService: ConfigService,
        private readonly fileService: FileServiceClient,
        private readonly cacheService: CacheService,
        private readonly prisma: PrismaService,
        private readonly rabbitmqProducer: RabbitMQProducerService,
    ) {
        this.logger.log("Using HTTP Payment Admin Controller");
        this.paymentServiceInternalKey = this.configService.get<string>('PAYMENT_SERVICE_INTERNAL_KEY', '');
    }

    // ─── Invoice Endpoints ────────────────────────────────────────────────────────

    @Get('invoices')
    @ApiOperation({ summary: 'List invoices for a program (Admin)' })
    @ApiQuery({ name: 'programId', required: true })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    @ApiQuery({ name: 'status', required: false })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'paymentMethod', required: false })
    @ApiQuery({ name: 'tierId', required: false })
    @ApiQuery({ name: 'feeType', required: false })
    @ApiQuery({ name: 'applicationStatus', required: false })
    @ApiQuery({
        name: 'followUpStatus',
        required: false,
        description:
            'participant_cancelled | payment_cancelled_issue | payment_failed | manual_proof_rejected',
    })
    @ApiQuery({ name: 'currency', required: false })
    @ApiQuery({ name: 'dateFrom', required: false, description: 'Invoice createdAt start (ISO date)' })
    @ApiQuery({ name: 'dateTo', required: false, description: 'Invoice createdAt end (ISO date)' })
    @ApiQuery({ name: 'paidFrom', required: false, description: 'Invoice paidAt start (ISO date)' })
    @ApiQuery({ name: 'paidTo', required: false, description: 'Invoice paidAt end (ISO date)' })
    @ApiQuery({ name: 'minAmount', required: false })
    @ApiQuery({ name: 'maxAmount', required: false })
    @ApiQuery({ name: 'sortBy', required: false, description: 'createdAt | paidAt | amount | updatedAt' })
    @ApiQuery({ name: 'sortOrder', required: false, description: 'asc | desc' })
    @ApiQuery({ name: 'cursor', required: false, description: 'Opaque cursor token for seek pagination' })
    async listInvoices(@Query() query: Record<string, string>) {
        const {
            programId,
            page = '1',
            limit = '20',
            status,
            search,
            paymentMethod,
            tierId,
            feeType,
            applicationStatus,
            followUpStatus,
            currency,
            dateFrom,
            dateTo,
            paidFrom,
            paidTo,
            minAmount,
            maxAmount,
            sortBy = 'updatedAt',
            sortOrder = 'desc',
            cursor,
        } = query;

        if (!programId) throw new HttpException('programId is required', 400);

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
        const skip = (pageNum - 1) * limitNum;
        const sortDirection = this.parseSortOrder(sortOrder);
        // cursor key present in query (even empty string) = opt-in to cursor mode
        const useCursorMode = cursor !== undefined;
        const cursorToken = cursor?.trim() || null;
        if (useCursorMode && sortBy !== 'createdAt') {
            throw new HttpException('cursor pagination only supports sortBy=createdAt', 400);
        }
        const decodedCursor = cursorToken ? this.decodeCreatedAtCursor(cursorToken) : null;
        const minAmountNum = typeof minAmount === 'string' && minAmount.trim() !== '' ? Number(minAmount) : undefined;
        const maxAmountNum = typeof maxAmount === 'string' && maxAmount.trim() !== '' ? Number(maxAmount) : undefined;

        const applicationFilter: Prisma.ParticipantApplicationWhereInput = { programId };
        const searchKeyword = search?.trim() || null;
        if (applicationStatus?.trim()) {
            applicationFilter.status = applicationStatus as Prisma.EnumApplicationStatusFilter;
        }

        const where: Prisma.ApplicationInvoiceWhereInput = { application: applicationFilter };
        const followUpWhere = this.buildFollowUpStatusWhere(followUpStatus);
        if (followUpWhere) {
            const andFilters = Array.isArray(where.AND)
                ? where.AND
                : where.AND
                    ? [where.AND]
                    : [];
            where.AND = [...andFilters, followUpWhere];
        }
        if (searchKeyword) {
            const participantSearch: Prisma.ParticipantWhereInput = {
                OR: [
                    { fullName: { contains: searchKeyword, mode: 'insensitive' } },
                    { user: { email: { contains: searchKeyword, mode: 'insensitive' } } },
                    { nationality: { contains: searchKeyword, mode: 'insensitive' } },
                    { originCountry: { contains: searchKeyword, mode: 'insensitive' } },
                ],
            };
            const invoiceSearch: Prisma.ApplicationInvoiceWhereInput[] = [
                { externalTransactionId: { contains: searchKeyword, mode: 'insensitive' } },
                { externalIntentId: { contains: searchKeyword, mode: 'insensitive' } },
                {
                    application: {
                        ...applicationFilter,
                        participant: participantSearch,
                    },
                },
            ];
            if (PaymentAdminController.UUID_RE.test(searchKeyword)) {
                invoiceSearch.unshift({ id: searchKeyword });
            }
            where.OR = invoiceSearch;
        }
        if (status) where.status = status as PaymentStatus;
        if (paymentMethod?.trim()) where.paymentMethod = paymentMethod.trim();
        if (tierId?.trim()) where.pricingTierId = tierId.trim();
        if (feeType?.trim()) {
            where.pricingTier = { feeType: feeType.trim() as Prisma.EnumPricingFeeTypeFilter };
        }
        if (currency?.trim()) where.currency = currency.trim();

        if (dateFrom || dateTo) {
            where.createdAt = {
                ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                ...(dateTo ? { lte: this.endOfDayUtc(dateTo) } : {}),
            };
        }
        if (paidFrom || paidTo) {
            where.paidAt = {
                ...(paidFrom ? { gte: new Date(paidFrom) } : {}),
                ...(paidTo ? { lte: this.endOfDayUtc(paidTo) } : {}),
            };
        }
        if (minAmountNum !== undefined || maxAmountNum !== undefined) {
            where.amount = {
                ...(minAmountNum !== undefined && !Number.isNaN(minAmountNum) ? { gte: new Prisma.Decimal(minAmountNum) } : {}),
                ...(maxAmountNum !== undefined && !Number.isNaN(maxAmountNum) ? { lte: new Prisma.Decimal(maxAmountNum) } : {}),
            };
        }

        const allowedSortBy: Record<string, Prisma.ApplicationInvoiceOrderByWithRelationInput> = {
            createdAt: { createdAt: sortDirection },
            paidAt: { paidAt: sortDirection },
            amount: { amount: sortDirection },
            updatedAt: { updatedAt: sortDirection },
        };
        const orderBy = useCursorMode
            ? [{ createdAt: sortDirection }, { id: sortDirection }]
            : (allowedSortBy[sortBy] ?? allowedSortBy.createdAt);
        const listWhere = useCursorMode
            ? this.buildCreatedAtCursorWhere(where, decodedCursor, sortDirection)
            : where;
        const summaryWhere: Prisma.ApplicationInvoiceWhereInput = { application: { programId } };
        // Status filter facet counts must reflect the OTHER active filters
        // (everything except the status filter itself), so each count equals
        // what selecting that status actually yields in the list. Prevents a
        // program-wide count (e.g. "Paid (12)") from disagreeing with the
        // filtered table (e.g. 7 rows).
        const statusFacetWhere: Prisma.ApplicationInvoiceWhereInput = { ...where };
        delete statusFacetWhere.status;

        const [
            invoices,
            total,
            summaryRows,
            overallSummaryRows,
            statusFacetRows,
            paidAggregate,
            totalsAggregate,
            tiers,
            paymentMethodOptionsRows,
            currencyOptionsRows,
            applicationStatusRows,
            participantCancelledCount,
            paymentCancelledIssueCount,
            paymentFailedCount,
            manualProofRejectedCount,
        ] = await Promise.all([
            this.prisma.applicationInvoice.findMany({
                where: listWhere,
                include: {
                    application: {
                        include: {
                            participant: {
                                include: {
                                    user: {
                                        select: {
                                            id: true,
                                            email: true,
                                            ambassador: { select: { id: true, referralCode: true, isActive: true, programId: true } },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    pricingTier: { select: { id: true, name: true, feeType: true, usdPrice: true, idrPrice: true } },
                },
                orderBy,
                ...(useCursorMode ? {} : { skip }),
                take: useCursorMode ? limitNum + 1 : limitNum,
            }),
            this.prisma.applicationInvoice.count({ where }),
            this.prisma.applicationInvoice.groupBy({
                by: ['status'],
                where,
                _count: { id: true },
                _sum: { amount: true },
            }),
            this.prisma.applicationInvoice.groupBy({
                by: ['status'],
                where: summaryWhere,
                _count: { id: true },
                _sum: { amount: true },
            }),
            this.prisma.applicationInvoice.groupBy({
                by: ['status'],
                where: statusFacetWhere,
                _count: { id: true },
            }),
            this.prisma.applicationInvoice.aggregate({
                where: { ...where, status: PaymentStatus.paid },
                _sum: { amount: true },
                _avg: { amount: true },
                _count: { id: true },
            }),
            this.prisma.applicationInvoice.aggregate({
                where,
                _sum: { amount: true },
                _count: { id: true },
            }),
            this.prisma.programPricingTier.findMany({
                where: { programId, deletedAt: null },
                select: { id: true, name: true, feeType: true },
                orderBy: { name: 'asc' },
            }),
            this.prisma.applicationInvoice.groupBy({
                by: ['paymentMethod'],
                where: {
                    application: { programId },
                    paymentMethod: { not: null },
                },
                _count: { id: true },
            }),
            this.prisma.applicationInvoice.groupBy({
                by: ['currency'],
                where: { application: { programId } },
                _count: { id: true },
            }),
            this.prisma.participantApplication.groupBy({
                by: ['status'],
                where: { programId, deletedAt: null },
                _count: { id: true },
            }),
            this.prisma.applicationInvoice.count({
                where: {
                    application: { programId },
                    status: PaymentStatus.cancelled,
                    rejectionReason: {
                        equals: PaymentAdminController.PARTICIPANT_CANCELLATION_REASON,
                        mode: 'insensitive',
                    },
                },
            }),
            this.prisma.applicationInvoice.count({
                where: {
                    application: { programId },
                    status: PaymentStatus.cancelled,
                    NOT: {
                        rejectionReason: {
                            equals: PaymentAdminController.PARTICIPANT_CANCELLATION_REASON,
                            mode: 'insensitive',
                        },
                    },
                },
            }),
            this.prisma.applicationInvoice.count({
                where: {
                    application: { programId },
                    status: PaymentStatus.failed,
                    verifiedBy: null,
                },
            }),
            this.prisma.applicationInvoice.count({
                where: {
                    application: { programId },
                    status: PaymentStatus.failed,
                    verifiedBy: { not: null },
                },
            }),
        ]);
        const paymentMethodCatalog = await this.getPaymentMethodCatalog();
        const hasMore = useCursorMode ? invoices.length > limitNum : pageNum * limitNum < total;
        const invoiceWindow = useCursorMode ? invoices.slice(0, limitNum) : invoices;
        await this.enrichInvoicePaymentMethods(invoiceWindow, paymentMethodCatalog);
        const nextCursor = useCursorMode && hasMore
            ? this.encodeCreatedAtCursor({
                id: invoiceWindow[invoiceWindow.length - 1]?.id,
                createdAt: invoiceWindow[invoiceWindow.length - 1]?.createdAt,
            })
            : null;

        const summary = this.initInvoiceSummary();
        const overallSummary = this.initInvoiceSummary();
        for (const row of summaryRows) {
            summary[row.status] = { count: row._count.id, amount: Number(row._sum.amount ?? 0) };
        }
        for (const row of overallSummaryRows) {
            overallSummary[row.status] = { count: row._count.id, amount: Number(row._sum.amount ?? 0) };
        }

        const invoiceTotalAmount = Number(totalsAggregate._sum.amount ?? 0);
        const paidAmount = Number(paidAggregate._sum.amount ?? 0);
        const paidCount = paidAggregate._count.id;
        const totalCount = totalsAggregate._count.id;
        const collectionRate = totalCount > 0 ? Number(((paidCount / totalCount) * 100).toFixed(1)) : 0;
        const avgPaidAmount = Number(paidAggregate._avg.amount ?? 0);

        const paymentMethodCounts = paymentMethodOptionsRows.reduce<Map<string, number>>((acc, row) => {
            const normalized = this.normalizePaymentMethod(row.paymentMethod as string | null, paymentMethodCatalog);
            if (!normalized) return acc;
            const existing = acc.get(normalized.value) ?? 0;
            acc.set(normalized.value, existing + row._count.id);
            return acc;
        }, new Map<string, number>());

        const paymentMethodsFilterOptions = paymentMethodCatalog.length > 0
            ? paymentMethodCatalog
                .map((item) => ({
                    value: item.value,
                    label: item.label,
                    count: paymentMethodCounts.get(item.value) ?? 0,
                }))
                .filter((item) => item.count > 0)
            : Array.from(paymentMethodCounts.entries()).map(([value, count]) => ({
                value,
                label: this.humanizeToken(value),
                count,
            }));

        return {
            data: invoiceWindow.map((inv) => this.toInvoiceDto(inv)),
            meta: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum),
                mode: useCursorMode ? 'cursor' : 'offset',
                cursor: cursorToken,
                nextCursor,
                hasMore,
            },
            summary,
            overallSummary,
            metrics: {
                totalInvoices: totalCount,
                totalAmount: invoiceTotalAmount,
                paidAmount,
                outstandingAmount: Math.max(invoiceTotalAmount - paidAmount, 0),
                collectionRate,
                averagePaidAmount: avgPaidAmount,
            },
            filters: {
                tiers: tiers.map((tier) => ({
                    id: tier.id,
                    name: tier.name,
                    feeType: tier.feeType,
                })),
                paymentMethods: paymentMethodsFilterOptions,
                currencies: currencyOptionsRows.map((row) => ({
                    value: row.currency,
                    count: row._count.id,
                })),
                applicationStatuses: applicationStatusRows.map((row) => ({
                    value: row.status,
                    count: row._count.id,
                })),
                invoiceStatuses: statusFacetRows.map((row) => ({
                    value: row.status,
                    count: row._count.id,
                })),
                followUpStatuses: [
                    { value: 'participant_cancelled', count: participantCancelledCount },
                    { value: 'payment_cancelled_issue', count: paymentCancelledIssueCount },
                    { value: 'payment_failed', count: paymentFailedCount },
                    { value: 'manual_proof_rejected', count: manualProofRejectedCount },
                ].filter((row) => row.count > 0),
                feeTypes: Array.from(
                    tiers.reduce<Map<string, number>>((acc, tier) => {
                        const existing = acc.get(tier.feeType) ?? 0;
                        acc.set(tier.feeType, existing + 1);
                        return acc;
                    }, new Map<string, number>()),
                ).map(([value, count]) => ({ value, count })),
            },
        };
    }

    private initInvoiceSummary(): Record<string, { count: number; amount: number }> {
        return {
            paid: { count: 0, amount: 0 },
            unpaid: { count: 0, amount: 0 },
            processing: { count: 0, amount: 0 },
            failed: { count: 0, amount: 0 },
            cancelled: { count: 0, amount: 0 },
            refunded: { count: 0, amount: 0 },
        };
    }

    private buildFollowUpStatusWhere(
        followUpStatus?: string,
    ): Prisma.ApplicationInvoiceWhereInput | null {
        switch ((followUpStatus ?? '').trim()) {
            case 'participant_cancelled':
                return {
                    status: PaymentStatus.cancelled,
                    rejectionReason: {
                        equals: PaymentAdminController.PARTICIPANT_CANCELLATION_REASON,
                        mode: 'insensitive',
                    },
                };
            case 'payment_cancelled_issue':
                return {
                    status: PaymentStatus.cancelled,
                    NOT: {
                        rejectionReason: {
                            equals: PaymentAdminController.PARTICIPANT_CANCELLATION_REASON,
                            mode: 'insensitive',
                        },
                    },
                };
            case 'payment_failed':
                return {
                    status: PaymentStatus.failed,
                    verifiedBy: null,
                };
            case 'manual_proof_rejected':
                return {
                    status: PaymentStatus.failed,
                    verifiedBy: { not: null },
                };
            default:
                return null;
        }
    }

    private isParticipantInitiatedCancellationReason(reason?: string | null): boolean {
        if (!reason) return false;
        return reason.trim().toLowerCase() === PaymentAdminController.PARTICIPANT_CANCELLATION_REASON.toLowerCase();
    }

    private parseSortOrder(sortOrder: string): Prisma.SortOrder {
        return sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc';
    }

    private endOfDayUtc(dateString: string): Date {
        const base = new Date(dateString);
        if (Number.isNaN(base.getTime())) {
            return new Date(dateString);
        }
        return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 23, 59, 59, 999));
    }

    private static readonly UUID_RE =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    private decodeCreatedAtCursor(cursor: string): { id: string; createdAt: Date } {
        try {
            const json = Buffer.from(cursor, 'base64url').toString('utf8');
            const parsed = JSON.parse(json) as { id?: string; createdAt?: string };
            if (!parsed.id || !parsed.createdAt) {
                throw new Error('missing cursor fields');
            }
            if (!PaymentAdminController.UUID_RE.test(parsed.id)) {
                throw new Error('invalid cursor id');
            }
            const createdAt = new Date(parsed.createdAt);
            if (Number.isNaN(createdAt.getTime())) {
                throw new Error('invalid cursor createdAt');
            }
            return { id: parsed.id, createdAt };
        } catch {
            throw new HttpException('Invalid cursor', 400);
        }
    }

    private encodeCreatedAtCursor(cursor: { id?: string; createdAt?: Date }): string | null {
        if (!cursor.id || !cursor.createdAt) return null;
        return Buffer.from(
            JSON.stringify({
                id: cursor.id,
                createdAt: cursor.createdAt.toISOString(),
            }),
            'utf8',
        ).toString('base64url');
    }

    private buildCreatedAtCursorWhere(
        baseWhere: Prisma.ApplicationInvoiceWhereInput,
        cursor: { id: string; createdAt: Date } | null,
        sortOrder: Prisma.SortOrder,
    ): Prisma.ApplicationInvoiceWhereInput {
        if (!cursor) return baseWhere;
        const cursorWindow = sortOrder === 'asc'
            ? {
                OR: [
                    { createdAt: { gt: cursor.createdAt } },
                    { createdAt: cursor.createdAt, id: { gt: cursor.id } },
                ],
            }
            : {
                OR: [
                    { createdAt: { lt: cursor.createdAt } },
                    { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                ],
            };
        return {
            AND: [
                baseWhere,
                cursorWindow,
            ],
        };
    }

    @Get('invoices/:id')
    @ApiOperation({ summary: 'Get invoice detail (Admin)' })
    async getInvoice(@Param('id') id: string) {
        const invoice = await this.prisma.applicationInvoice.findUnique({
            where: { id },
            include: {
                application: {
                    include: {
                        participant: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        email: true,
                                        ambassador: { select: { id: true, referralCode: true, isActive: true, programId: true } },
                                    },
                                },
                            },
                        },
                    },
                },
                pricingTier: { select: { id: true, name: true, feeType: true, usdPrice: true, idrPrice: true } },
            },
        });

        if (!invoice) throw new HttpException('Invoice not found', 404);

        let transaction: Record<string, unknown> | null = null;
        let transactions: Array<Record<string, unknown>> = [];
        const paymentMethodCatalog = await this.getPaymentMethodCatalog();
        let resolvedMethod = this.normalizePaymentMethod(invoice.paymentMethod, paymentMethodCatalog);

        if (invoice.externalIntentId) {
            try {
                const { data } = await this.paymentServiceClient.get(
                    `/api/v1/payments/${invoice.externalIntentId}`,
                    { headers: this.buildInternalHeaders() },
                );
                transactions = this.extractTransactionsFromPaymentPayload(data, paymentMethodCatalog);
                transaction = this.pickCurrentTransaction(transactions, invoice.externalTransactionId);
                if (!resolvedMethod && transaction) {
                    const extractedFromTxn = this.extractPaymentMethodFromTransaction(transaction);
                    resolvedMethod = this.normalizePaymentMethod(extractedFromTxn, paymentMethodCatalog);
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.logger.warn(`Failed to fetch payment intent ${invoice.externalIntentId}: ${message}`);
            }
        }

        if (!transaction && invoice.externalTransactionId) {
            try {
                const { data } = await this.paymentServiceClient.get(
                    `/api/v1/payments/${invoice.externalTransactionId}`,
                    { headers: this.buildInternalHeaders() },
                );
                if (data && typeof data === 'object' && !Array.isArray(data)) {
                    transaction = this.decoratePaymentTransaction(data as Record<string, unknown>, paymentMethodCatalog);
                    if (
                        invoice.externalTransactionId &&
                        !transactions.some((item) =>
                            this.matchesTransaction(item, invoice.externalTransactionId as string),
                        )
                    ) {
                        transactions = [transaction, ...transactions];
                    }
                    if (!resolvedMethod) {
                        const extractedFromTxn = this.extractPaymentMethodFromTransaction(transaction);
                        resolvedMethod = this.normalizePaymentMethod(extractedFromTxn, paymentMethodCatalog);
                    }
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.logger.warn(`Failed to fetch transaction ${invoice.externalTransactionId}: ${message}`);
            }
        }

        const enrichedInvoice = {
            ...invoice,
            paymentMethod: resolvedMethod?.label ?? null,
        };

        return { ...this.toInvoiceDto(enrichedInvoice), transaction, transactions };
    }

    @Post('invoices/:id/verify')
    @ApiOperation({ summary: 'Verify manual payment (approve/reject)' })
    async verifyInvoice(
        @Param('id') id: string,
        @Body() body: { action: 'approve' | 'reject'; reason?: string },
            @CurrentUser() user: CurrentUserData,
    ) {
        if (body.action !== 'approve' && body.action !== 'reject') {
            throw new HttpException("Invalid action. Use 'approve' or 'reject'", 400);
        }
        if (body.action === 'reject' && !body.reason?.trim()) {
            throw new HttpException('Reason is required for rejection', 400);
        }

        const invoice = await this.prisma.applicationInvoice.findUnique({
            where: { id },
            select: {
                id: true,
                applicationId: true,
                amount: true,
                currency: true,
                externalTransactionId: true,
                application: {
                    select: {
                        id: true,
                        participant: {
                            select: {
                                fullName: true,
                                userId: true,
                                user: { select: { email: true } },
                            },
                        },
                        program: {
                            select: {
                                brand: {
                                    select: {
                                        landingUrl: true,
                                        websiteUrl: true,
                                        name: true,
                                        primaryColor: true,
                                        logoUrl: true,
                                        contactEmail: true,
                                        contactAddress: true,
                                        socialMediaLinks: true,
                                        settings: {
                                            select: {
                                                footerNavigation: true,
                                                supportEmail: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                pricingTier: {
                    select: { feeType: true },
                },
            },
        });

        if (!invoice) throw new HttpException('Invoice not found', 404);
        if (!invoice.externalTransactionId) {
            throw new HttpException('No transaction linked to this invoice', 400);
        }

        try {
            const { data } = await this.paymentServiceClient.post(
                `/api/v1/payments/${invoice.externalTransactionId}/verify`,
                { action: body.action, reason: body.reason ?? '', admin_id: user.userId },
                { headers: this.buildInternalHeaders() },
            );

            // Persist verifier audit trail on the local invoice. Source of truth for
            // who/when/why; the payment service stores the same in PaymentTransaction.
            const now = new Date();
            if (body.action === 'reject') {
                const paymentStatusPatch =
                    invoice.pricingTier?.feeType === 'registration_fee'
                        ? { registrationPaymentStatus: PaymentStatus.failed }
                        : { programPaymentStatus: PaymentStatus.failed };

                await this.prisma.$transaction([
                    this.prisma.applicationInvoice.update({
                        where: { id },
                        data: {
                            status: PaymentStatus.failed,
                            paidAt: null,
                            verifiedBy: user.userId,
                            verifiedAt: now,
                            rejectionReason: body.reason ?? null,
                        },
                    }),
                    this.prisma.participantApplication.update({
                        where: { id: invoice.application.id },
                        data: paymentStatusPatch,
                    }),
                ]);
            } else {
                await this.prisma.applicationInvoice.update({
                    where: { id },
                    data: {
                        verifiedBy: user.userId,
                        verifiedAt: now,
                        rejectionReason: null,
                    },
                });
            }

            const participantUserId = invoice.application?.participant?.userId;
            if (participantUserId) {
                await this.cacheService.invalidateInvoiceCache(id, participantUserId);
            }

            // Notify participant when admin rejects the payment so they know to
            // resubmit with the admin-provided reason.
            if (body.action === 'reject') {
                const email = invoice.application?.participant?.user?.email;
                if (email) {
                    const rawBrand = invoice.application?.program?.brand ?? null;
                    const paymentsPageUrl = this.buildParticipantPaymentsUrl(rawBrand);
                    if (!paymentsPageUrl) {
                        this.logger.warn(
                            `payment.rejected for invoice ${id} has no paymentsPageUrl: brand.landingUrl/websiteUrl unset`,
                        );
                    }
                    const brandPayload = rawBrand
                        ? {
                            name: rawBrand.name,
                            primaryColor: rawBrand.primaryColor,
                            logoUrl: rawBrand.logoUrl,
                            websiteUrl: rawBrand.websiteUrl,
                            contactEmail: rawBrand.contactEmail,
                            contactAddress: rawBrand.contactAddress,
                            socialMediaLinks: rawBrand.socialMediaLinks,
                            settings: rawBrand.settings
                                ? {
                                    footerNavigation: rawBrand.settings.footerNavigation,
                                    supportEmail: rawBrand.settings.supportEmail,
                                }
                                : null,
                        }
                        : null;
                    try {
                        await this.rabbitmqProducer.emit('payment.rejected', {
                            email,
                            customer_name: invoice.application?.participant?.fullName ?? 'Participant',
                            amount: Number(invoice.amount),
                            currency: invoice.currency,
                            order_id: invoice.id,
                            reason: body.reason?.trim() || 'No reason provided',
                            paymentsPageUrl,
                            brand: brandPayload,
                            metadata: {
                                application_id: invoice.applicationId,
                                invoice_id: invoice.id,
                                verified_by: user.userId,
                                verified_at: now.toISOString(),
                            },
                        });
                    } catch (emitError) {
                        const message = emitError instanceof Error ? emitError.message : String(emitError);
                        this.logger.error(
                            `Failed to publish payment.rejected for invoice ${id}: ${message}`,
                        );
                        // Do not fail the verify request just because notification dispatch hiccuped.
                    }
                } else {
                    this.logger.warn(
                        `Skipping payment.rejected notification for invoice ${id}: participant email not found`,
                    );
                }
            }

            return data;
        } catch (error) {
            this.handleError(error);
        }
    }

    // Resolve the participant payments URL from the brand the invoice belongs to.
    // landingUrl is canonical; websiteUrl is a fallback for brands that haven't
    // configured one yet. Returns empty when neither is set so the notification
    // template can render without a CTA rather than linking to nowhere.
    private buildParticipantPaymentsUrl(
        brand: { landingUrl?: string | null; websiteUrl?: string | null } | null | undefined,
    ): string {
        return buildParticipantPaymentsDashboardUrl(brand);
    }

    @Patch('invoices/:id/status')
    @ApiOperation({ summary: 'Update invoice status (manual transfer/admin override)' })
    async updateInvoiceStatus(
        @Param('id') id: string,
        @Body() body: {
            status: PaymentStatus;
            reason?: string;
            /** Required when marking an invoice paid with no linked payment transaction. */
            manualOverride?: boolean;
            /** Human-readable justification — required alongside manualOverride. */
            overrideReason?: string;
        },
        @CurrentUser() user: CurrentUserData,
    ) {
        if (!Object.values(PaymentStatus).includes(body.status)) {
            throw new HttpException('Invalid payment status', 400);
        }

        const invoice = await this.prisma.applicationInvoice.findUnique({
            where: { id },
            include: {
                pricingTier: { select: { feeType: true } },
                application: {
                    select: {
                        id: true,
                        participant: { select: { userId: true } },
                    },
                },
            },
        });

        if (!invoice) {
            throw new HttpException('Invoice not found', 404);
        }

        // Guard: if marking as paid, require that a successful real payment transaction
        // is linked. Merely having an externalTransactionId / externalIntentId is
        // insufficient — a FAILED, CANCELLED, UNPAID, or still-PROCESSING (stalled,
        // no completion webhook) transaction can also leave those IDs populated.
        // A "real payment" requires IDs AND that the invoice is already in a confirmed
        // paid/refunded state; any non-confirmed state means the linked transaction
        // has not successfully settled.
        // When no real payment is confirmed, require manualOverride + overrideReason.
        // NOTE: a dedicated audit column for the override reason is recommended but
        // not yet added to the schema; the reason is durably logged here until then.
        if (body.status === PaymentStatus.paid) {
            const hasExternalIds =
                (invoice.externalTransactionId != null && invoice.externalTransactionId.trim().length > 0)
                || (invoice.externalIntentId != null && invoice.externalIntentId.trim().length > 0);

            // Only an invoice already settled as paid/refunded reflects a confirmed
            // payment. unpaid/processing/failed/cancelled are all unconfirmed — a
            // stalled processing intent (IDs set, webhook never arrived) is NOT proof.
            const isConfirmedSettled =
                invoice.status === PaymentStatus.paid
                || invoice.status === PaymentStatus.refunded;

            const hasRealPayment = hasExternalIds && isConfirmedSettled;

            if (!hasRealPayment) {
                const overrideReason = body.overrideReason?.trim() ?? '';
                if (body.manualOverride !== true || overrideReason.length === 0) {
                    const reason = !hasExternalIds
                        ? 'This invoice has no linked payment transaction.'
                        : 'The linked payment transaction has not settled successfully (invoice is not in a confirmed paid state).';
                    throw new BadRequestException(
                        reason + ' To override, set manualOverride=true and provide a non-empty overrideReason.',
                    );
                }
                this.logger.warn(
                    `Manual payment override applied — admin: ${user.userId}, `
                    + `invoice: ${id}, application: ${invoice.application.id}, `
                    + `invoiceStatus: ${invoice.status}, `
                    + `reason: "${overrideReason}"`,
                );
            }
        }

        const trimmedReason = body.reason?.trim() ?? '';
        const now = new Date();
        // Audit fields: capture who/when on every admin-driven status change, plus
        // the rejection reason when failing/cancelling so the participant gets context.
        const isVerifierAuditableStatus =
            body.status === PaymentStatus.paid
            || body.status === PaymentStatus.failed
            || body.status === PaymentStatus.cancelled;

        const auditPatch: Pick<Prisma.ApplicationInvoiceUpdateInput, 'verifiedBy' | 'verifiedAt' | 'rejectionReason'> =
            isVerifierAuditableStatus
                ? {
                    verifiedBy: user.userId,
                    verifiedAt: now,
                    rejectionReason:
                        body.status === PaymentStatus.paid
                            ? null
                            : (trimmedReason.length > 0 ? trimmedReason : null),
                }
                : {};

        const updatePayload: Prisma.ApplicationInvoiceUpdateInput = {
            status: body.status,
            paidAt: body.status === PaymentStatus.paid ? (invoice.paidAt ?? now) : null,
            ...auditPatch,
        };

        const isRegistrationFee = invoice.pricingTier.feeType === 'registration_fee';
        const appPaymentPatch: Prisma.ParticipantApplicationUpdateInput = isRegistrationFee
            ? { registrationPaymentStatus: body.status }
            : { programPaymentStatus: body.status };

        const [updatedInvoice] = await this.prisma.$transaction([
            this.prisma.applicationInvoice.update({
                where: { id },
                data: updatePayload,
                include: {
                    application: {
                        include: {
                            participant: {
                                include: {
                                    user: {
                                        select: {
                                            id: true,
                                            email: true,
                                            ambassador: { select: { id: true, referralCode: true, isActive: true, programId: true } },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    pricingTier: { select: { id: true, name: true, feeType: true, usdPrice: true, idrPrice: true } },
                },
            }),
            this.prisma.participantApplication.update({
                where: { id: invoice.application.id },
                data: appPaymentPatch,
            }),
        ]);

        const participantUserId = invoice.application?.participant?.userId;
        if (participantUserId) {
            await this.cacheService.invalidateInvoiceCache(id, participantUserId);
        }

        // Keep payment service in sync for manual verification flows where possible.
        if (invoice.externalTransactionId && (body.status === PaymentStatus.paid || body.status === PaymentStatus.failed)) {
            try {
                await this.paymentServiceClient.post(
                    `/api/v1/payments/${invoice.externalTransactionId}/verify`,
                    {
                        action: body.status === PaymentStatus.paid ? 'approve' : 'reject',
                        reason: body.reason ?? '',
                    },
                    { headers: this.buildInternalHeaders() },
                );
            } catch (error) {
                this.logger.warn(`Could not sync payment status to payment service for invoice ${id}: ${(error as Error).message}`);
            }
        }

        return this.toInvoiceDto(updatedInvoice);
    }

    // ─── Payment Method Endpoints ─────────────────────────────────────────────────

    @Get('methods')
    @ApiOperation({ summary: 'List payment methods (Admin)' })
    @ApiQuery({ name: 'is_active', required: false, type: Boolean })
    @ApiResponse({ status: 200, description: 'List of payment methods' })
    async listMethods(@Query() query: Record<string, string>) {
        try {
            const queryParams = JSON.stringify(query);
            const cacheKey = CACHE_KEYS.PAYMENT_METHODS(queryParams);

            const cached = await this.cacheService.get(cacheKey);
            if (cached) return cached;

            const { data } = await this.paymentServiceClient.get('/api/v1/payment-methods', {
                params: query,
                headers: this.buildInternalHeaders(),
            });

            await this.cacheService.set(cacheKey, data, CACHE_TTL.MEDIUM);

            return data;
        } catch (error) {
            this.handleError(error);
        }
    }

    @Post('methods')
    @AuditTrail({ entityType: 'PaymentMethod', action: ChangeType.create })
    @ApiOperation({ summary: 'Create payment method' })
    @ApiBody({ type: CreatePaymentMethodDto })
    @ApiResponse({ status: 201, description: 'Payment method created' })
    async createMethod(@Body() body: CreatePaymentMethodDto, @CurrentUser() user: CurrentUserData) {
        try {
            if (body.icon) {
                body.icon = await this.resolveIconUrl(body.icon, user);
            }

            this.logger.log(`Creating payment method with icon: ${body.icon}`);

            const { data } = await this.paymentServiceClient.post('/api/v1/payment-methods', body, {
                headers: this.buildInternalHeaders(),
            });

            await this.cacheService.invalidateByPattern('payment:methods:*');
            await this.cacheService.invalidateByPattern('landing:home:*');

            return data;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const stack = error instanceof Error ? error.stack : undefined;
            this.logger.error(`Create method failed: ${message}`, stack);
            this.handleError(error);
        }
    }

    @Get('methods/:id')
    @ApiOperation({ summary: 'Get payment method detail' })
    @ApiResponse({ status: 200, description: 'Payment method detail' })
    async getMethod(@Param('id') id: string) {
        try {
            const { data } = await this.paymentServiceClient.get(`/api/v1/payment-methods/${id}`, {
                headers: this.buildInternalHeaders(),
            });
            return data;
        } catch (error) {
            this.handleError(error);
        }
    }

    @Put('methods/:id')
    @AuditTrail({ entityType: 'PaymentMethod', action: ChangeType.update })
    @ApiOperation({ summary: 'Update payment method' })
    @ApiBody({ type: UpdatePaymentMethodDto })
    @ApiResponse({ status: 200, description: 'Payment method updated' })
    async updateMethod(@Param('id') id: string, @Body() body: UpdatePaymentMethodDto, @CurrentUser() user: CurrentUserData) {
        try {
            if (body.icon) {
                body.icon = await this.resolveIconUrl(body.icon, user);
            }

            const { data } = await this.paymentServiceClient.put(`/api/v1/payment-methods/${id}`, body, {
                headers: this.buildInternalHeaders(),
            });

            await this.cacheService.invalidateByPattern('payment:methods:*');
            await this.cacheService.invalidateByPattern('landing:home:*');

            return data;
        } catch (error) {
            this.handleError(error);
        }
    }

    @Delete('methods/:id')
    @AuditTrail({ entityType: 'PaymentMethod', action: ChangeType.delete })
    @ApiOperation({ summary: 'Delete payment method' })
    @ApiResponse({ status: 200, description: 'Payment method deleted' })
    async deleteMethod(@Param('id') id: string) {
        try {
            const { data } = await this.paymentServiceClient.delete(`/api/v1/payment-methods/${id}`, {
                headers: this.buildInternalHeaders(),
            });

            await this.cacheService.invalidateByPattern('payment:methods:*');
            await this.cacheService.invalidateByPattern('landing:home:*');

            return data;
        } catch (error) {
            this.handleError(error);
        }
    }

    // ─── Private Helpers ──────────────────────────────────────────────────────────

    private async getPaymentMethodCatalog(): Promise<Array<{ value: string; label: string }>> {
        try {
            const { data } = await this.paymentServiceClient.get('/api/v1/payment-methods', {
                headers: this.buildInternalHeaders(),
            });
            const payload = data as {
                data?: Array<Record<string, unknown>>;
            } | Array<Record<string, unknown>>;
            const methods = Array.isArray(payload)
                ? payload
                : Array.isArray(payload?.data)
                    ? payload.data
                    : [];

            const dedup = new Map<string, { value: string; label: string }>();
            for (const method of methods) {
                const rawValue = this.pickString(method.code, method.id, method.name, method.display_name);
                if (!rawValue) continue;
                const value = rawValue.trim();
                if (!value) continue;
                const normalizedValue = value.toLowerCase();
                if (this.isUnknownMethod(normalizedValue)) continue;

                const label = this.pickString(method.display_name, method.name) ?? this.humanizeToken(value);
                if (!dedup.has(normalizedValue)) {
                    dedup.set(normalizedValue, { value, label });
                }
            }

            return Array.from(dedup.values()).sort((a, b) => a.label.localeCompare(b.label));
        } catch (error) {
            this.logger.warn(`Failed to load payment method catalog: ${(error as Error).message}`);
            return [];
        }
    }

    private async enrichInvoicePaymentMethods(
        invoices: Array<{ paymentMethod: string | null; externalTransactionId?: string | null }>,
        catalog: Array<{ value: string; label: string }>,
    ): Promise<void> {
        await Promise.all(invoices.map(async (invoice) => {
            const normalizedExisting = this.normalizePaymentMethod(invoice.paymentMethod, catalog);
            if (normalizedExisting) {
                invoice.paymentMethod = normalizedExisting.label;
                return;
            }

            if (!invoice.externalTransactionId) {
                invoice.paymentMethod = null;
                return;
            }

            try {
                const { data } = await this.paymentServiceClient.get(
                    `/api/v1/payments/${invoice.externalTransactionId}`,
                    { headers: this.buildInternalHeaders() },
                );
                const transaction = data as Record<string, unknown>;
                const extracted = this.extractPaymentMethodFromTransaction(transaction);
                const normalizedFromTransaction = this.normalizePaymentMethod(extracted, catalog);
                invoice.paymentMethod = normalizedFromTransaction?.label ?? null;
            } catch (error) {
                this.logger.debug(`Could not resolve payment method for tx ${invoice.externalTransactionId}: ${(error as Error).message}`);
                invoice.paymentMethod = null;
            }
        }));
    }

    private extractPaymentMethodFromTransaction(transaction: Record<string, unknown>): string | null {
        const source = this.unwrapPayloadObject(transaction);
        return this.findPaymentMethodDeep(source, 0);
    }

    private findPaymentMethodDeep(value: unknown, depth: number): string | null {
        if (depth > 5 || value === null || value === undefined) {
            return null;
        }

        if (typeof value === 'string') {
            return this.isUnknownMethod(value) ? null : value;
        }

        if (Array.isArray(value)) {
            for (const item of value) {
                const found = this.findPaymentMethodDeep(item, depth + 1);
                if (found) return found;
            }
            return null;
        }

        if (typeof value !== 'object') {
            return null;
        }

        const record = value as Record<string, unknown>;
        const direct = this.pickString(
            record.payment_method,
            record.paymentMethod,
            record.payment_method_id,
            record.paymentMethodId,
            record.payment_method_name,
            record.paymentMethodName,
            record.method_name,
            record.method,
        );
        if (direct && !this.isUnknownMethod(direct)) {
            return direct;
        }

        for (const nested of Object.values(record)) {
            const found = this.findPaymentMethodDeep(nested, depth + 1);
            if (found) return found;
        }
        return null;
    }

    private unwrapPayloadObject(payload: Record<string, unknown>): Record<string, unknown> {
        if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
            return payload.data as Record<string, unknown>;
        }
        return payload;
    }

    private extractTransactionsFromPaymentPayload(
        payload: unknown,
        catalog: Array<{ value: string; label: string }>,
    ): Array<Record<string, unknown>> {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            return [];
        }

        const source = this.unwrapPayloadObject(payload as Record<string, unknown>);
        const rawTransactions = Array.isArray(source.transactions) ? source.transactions : [];

        return rawTransactions
            .filter(
                (item): item is Record<string, unknown> =>
                    Boolean(item) && typeof item === 'object' && !Array.isArray(item),
            )
            .map((item) => this.decoratePaymentTransaction(item, catalog));
    }

    private decoratePaymentTransaction(
        transaction: Record<string, unknown>,
        catalog: Array<{ value: string; label: string }>,
    ): Record<string, unknown> {
        const source = this.unwrapPayloadObject(transaction);
        const extractedMethod = this.extractPaymentMethodFromTransaction(source);
        const normalizedMethod = this.normalizePaymentMethod(extractedMethod, catalog);

        return {
            ...source,
            payment_method_label: normalizedMethod?.label ?? null,
        };
    }

    private pickCurrentTransaction(
        transactions: Array<Record<string, unknown>>,
        externalTransactionId: string | null,
    ): Record<string, unknown> | null {
        if (transactions.length === 0) return null;
        if (!externalTransactionId) return transactions[0];

        const matched = transactions.find((transaction) =>
            this.matchesTransaction(transaction, externalTransactionId),
        );
        return matched ?? transactions[0];
    }

    private matchesTransaction(
        transaction: Record<string, unknown>,
        externalTransactionId: string,
    ): boolean {
        const transactionId = this.pickString(
            transaction.id,
            transaction.transaction_id,
            transaction.transactionId,
        );
        return transactionId === externalTransactionId;
    }

    private normalizePaymentMethod(
        rawMethod: string | null,
        catalog: Array<{ value: string; label: string }>,
    ): { value: string; label: string } | null {
        if (!rawMethod) return null;
        const token = rawMethod.trim();
        if (!token) return null;
        const normalizedToken = token.toLowerCase();
        if (this.isUnknownMethod(normalizedToken)) return null;

        const matched = catalog.find((item) => {
            const value = item.value.toLowerCase();
            const label = item.label.toLowerCase();
            return value === normalizedToken || label === normalizedToken;
        });
        if (matched) {
            return matched;
        }

        return { value: token, label: this.humanizeToken(token) };
    }

    private isUnknownMethod(value: string): boolean {
        return ['unknown', '-', 'n/a', 'na', 'null', 'undefined'].includes(value.trim().toLowerCase());
    }

    private pickString(...values: unknown[]): string | null {
        for (const value of values) {
            if (typeof value === 'string' && value.trim()) {
                return value;
            }
        }
        return null;
    }

    private humanizeToken(value: string): string {
        const token = value.trim();
        if (!token) return '';
        return token
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());
    }

    private toInvoiceDto(invoice: any) {
        const pricingTier = invoice.pricingTier as
            | {
                id: string;
                name: string;
                feeType: string;
                usdPrice?: { toString(): string } | number | null;
                idrPrice?: { toString(): string } | number | null;
            }
            | undefined;

        // Dual-price snapshots frozen at intent creation. `amount`/`currency`
        // remain the canonical settlement values (flipped to IDR on manual
        // confirm); these are reference fields so admin views can show both
        // sides of the dual price even after settlement.
        const amountUsd =
            invoice.amountUsd === null || invoice.amountUsd === undefined
                ? null
                : Number(invoice.amountUsd);
        const amountIdr =
            invoice.amountIdr === null || invoice.amountIdr === undefined
                ? null
                : Number(invoice.amountIdr);

        return {
            id: invoice.id as string,
            applicationId: invoice.applicationId as string,
            amount: Number(invoice.amount),
            currency: invoice.currency as string,
            amountUsd,
            amountIdr,
            status: invoice.status as string,
            paymentMethod: invoice.paymentMethod as string | null,
            paidAt: invoice.paidAt ? (invoice.paidAt as Date).toISOString() : null,
            externalTransactionId: invoice.externalTransactionId as string | null,
            externalIntentId: invoice.externalIntentId as string | null,
            pricingTier: pricingTier
                ? {
                    id: pricingTier.id,
                    name: pricingTier.name,
                    feeType: pricingTier.feeType,
                    usdPrice:
                        pricingTier.usdPrice === null || pricingTier.usdPrice === undefined
                            ? null
                            : Number(pricingTier.usdPrice),
                    idrPrice:
                        pricingTier.idrPrice === null || pricingTier.idrPrice === undefined
                            ? null
                            : Number(pricingTier.idrPrice),
                }
                : null,
            // Verifier audit trail — set when an admin approves, rejects, or
            // manually overrides the invoice. Null on auto-progressed invoices.
            verifiedBy: (invoice.verifiedBy ?? null) as string | null,
            verifiedAt: invoice.verifiedAt ? (invoice.verifiedAt as Date).toISOString() : null,
            rejectionReason: (invoice.rejectionReason ?? null) as string | null,
            followUpStatus:
                invoice.status === PaymentStatus.cancelled
                    ? (
                        this.isParticipantInitiatedCancellationReason(invoice.rejectionReason)
                            ? 'participant_cancelled'
                            : 'payment_cancelled_issue'
                    )
                    : invoice.status === PaymentStatus.failed
                        ? (invoice.verifiedBy ? 'manual_proof_rejected' : 'payment_failed')
                        : null,
            application: {
                status: invoice.application.status as string,
                applicationCategory: invoice.application.applicationCategory as string | null,
                ticketStatus: invoice.application.ticketStatus as string | null,
            },
            participant: {
                id: invoice.application.participant.id as string,
                fullName: invoice.application.participant.fullName as string,
                userId: invoice.application.participant.userId as string,
                email: (invoice.application.participant.user?.email ?? null) as string | null,
                nationality: (invoice.application.participant.nationality ?? null) as string | null,
                originCountry: (invoice.application.participant.originCountry ?? null) as string | null,
                ambassador: invoice.application.participant.user?.ambassador
                    ? {
                        referralCode: invoice.application.participant.user.ambassador.referralCode as string,
                        isActive: invoice.application.participant.user.ambassador.isActive as boolean,
                        isSameProgram: invoice.application.participant.user.ambassador.programId === (invoice.application.programId as string | undefined),
                    }
                    : null,
            },
            createdAt: (invoice.createdAt as Date).toISOString(),
            updatedAt: (invoice.updatedAt as Date).toISOString(),
        };
    }

    private async resolveIconUrl(icon: string, user: CurrentUserData): Promise<string> {
        this.logger.log(`Resolving icon UUID: ${icon}. User: ${user.userId}, Brand: ${user.brandId}`);
        let candidate = icon.trim();
        if (!this.isValidUUID(candidate)) {
            const extracted = this.extractUuidFromString(candidate);
            if (!extracted) {
                this.logger.debug(`Icon ${icon} is not a valid UUID, returning as is`);
                return icon;
            }
            candidate = extracted;
        }

        try {
            const fileInfo = await this.fileService.getFile(candidate, user.userId, user.brandId);
            this.logger.log(`Resolved file info received`);

            const data = (fileInfo.data || fileInfo) as Record<string, string | undefined>;
            const resolvedUrl = data.url || data.display_url;

            if (resolvedUrl) {
                this.logger.log(`Resolved URL: ${resolvedUrl}`);
                return resolvedUrl;
            }

            if (data.download_url) {
                this.logger.log(`Using download URL: ${data.download_url}`);
                return data.download_url;
            }

            this.logger.warn(`File info found but no URL property. Keys: ${Object.keys(data)}`);
            return icon;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Failed to resolve icon UUID: ${icon}. Error: ${message}`);
            const response = (error as { response?: { status?: number; data?: unknown } })?.response;
            if (response) {
                this.logger.warn(`Error details: ${response.status ?? 'unknown'} ${JSON.stringify(response.data)}`);
            }
            return icon;
        }
    }

    private isValidUUID(uuid: string): boolean {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }

    private extractUuidFromString(value: string): string | null {
        const match = value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}/i);
        return match?.[0] ?? null;
    }

    private handleError(error: unknown): never {
        const err = error as { response?: { status: number; data: unknown }; message?: string };
        if (err.response) {
            this.logger.error(`Payment Service Error: ${err.response.status} - ${JSON.stringify(err.response.data)}`);
            const status = err.response.status;
            // Forward 4xx user-facing errors from payment service; mask 5xx
            if (status >= 400 && status < 500) {
                const data = err.response.data;
                const userMsg = (typeof data === 'object' && data !== null && 'message' in data)
                    ? String((data as { message: unknown }).message)
                    : 'Payment request failed';
                throw new HttpException(userMsg, status);
            }
            throw new HttpException('Payment service unavailable. Please try again later.', 503);
        }
        this.logger.error(`Internal Error: ${err.message}`);
        throw new HttpException('Something went wrong. Please try again later.', 500);
    }

    private buildInternalHeaders(): Record<string, string> {
        if (!this.paymentServiceInternalKey) {
            return {};
        }

        return {
            'X-Internal-Service-Key': this.paymentServiceInternalKey,
        };
    }
}
