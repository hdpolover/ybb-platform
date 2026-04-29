import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    UseGuards,
    Query,
    HttpException,
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

@ApiTags('Admin Payments')
@Controller('admin/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class PaymentAdminController {
    private readonly paymentServiceInternalKey: string;
    private readonly logger = new Logger(PaymentAdminController.name);

    constructor(
        private readonly paymentServiceClient: PaymentServiceHttpClient,
        private readonly configService: ConfigService,
        private readonly fileService: FileServiceClient,
        private readonly cacheService: CacheService,
        private readonly prisma: PrismaService,
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
    async listInvoices(@Query() query: Record<string, string>) {
        const { programId, page = '1', limit = '20', status, search } = query;

        if (!programId) throw new HttpException('programId is required', 400);

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
        const skip = (pageNum - 1) * limitNum;

        const applicationFilter: Prisma.ParticipantApplicationWhereInput = { programId };
        if (search?.trim()) {
            applicationFilter.participant = {
                OR: [
                    { fullName: { contains: search.trim(), mode: 'insensitive' } },
                    { user: { email: { contains: search.trim(), mode: 'insensitive' } } },
                ],
            };
        }

        const where: Prisma.ApplicationInvoiceWhereInput = { application: applicationFilter };
        if (status) where.status = status as PaymentStatus;

        const [invoices, total, summaryRows] = await Promise.all([
            this.prisma.applicationInvoice.findMany({
                where,
                include: {
                    application: {
                        include: {
                            participant: {
                                include: { user: { select: { id: true, email: true } } },
                            },
                        },
                    },
                    pricingTier: { select: { id: true, name: true, feeType: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum,
            }),
            this.prisma.applicationInvoice.count({ where }),
            this.prisma.applicationInvoice.groupBy({
                by: ['status'],
                where: { application: { programId } },
                _count: { id: true },
                _sum: { amount: true },
            }),
        ]);

        const summary: Record<string, { count: number; amount: number }> = {
            paid: { count: 0, amount: 0 },
            unpaid: { count: 0, amount: 0 },
            processing: { count: 0, amount: 0 },
            failed: { count: 0, amount: 0 },
            refunded: { count: 0, amount: 0 },
        };
        for (const row of summaryRows) {
            summary[row.status] = { count: row._count.id, amount: Number(row._sum.amount ?? 0) };
        }

        return {
            data: invoices.map((inv) => this.toInvoiceDto(inv)),
            meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
            summary,
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
                            include: { user: { select: { id: true, email: true } } },
                        },
                    },
                },
                pricingTier: { select: { id: true, name: true, feeType: true } },
            },
        });

        if (!invoice) throw new HttpException('Invoice not found', 404);

        let transaction: unknown = null;
        if (invoice.externalTransactionId) {
            try {
                const { data } = await this.paymentServiceClient.get(
                    `/api/v1/payments/${invoice.externalTransactionId}`,
                    { headers: this.buildInternalHeaders() },
                );
                transaction = data;
            } catch (e) {
                this.logger.warn(`Failed to fetch transaction ${invoice.externalTransactionId}: ${e.message}`);
            }
        }

        return { ...this.toInvoiceDto(invoice), transaction };
    }

    @Post('invoices/:id/verify')
    @ApiOperation({ summary: 'Verify manual payment (approve/reject)' })
    async verifyInvoice(
        @Param('id') id: string,
        @Body() body: { action: 'approve' | 'reject'; reason?: string },
        @CurrentUser() user: CurrentUserData,
    ) {
        const invoice = await this.prisma.applicationInvoice.findUnique({
            where: { id },
            select: {
                externalTransactionId: true,
                application: {
                    select: {
                        participant: { select: { userId: true } },
                    },
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

            const participantUserId = invoice.application?.participant?.userId;
            if (participantUserId) {
                await this.cacheService.invalidateInvoiceCache(id, participantUserId);
            }

            return data;
        } catch (error) {
            this.handleError(error);
        }
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
            this.logger.error(`Create method failed: ${error.message}`, error.stack);
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

    private toInvoiceDto(invoice: any) {
        return {
            id: invoice.id as string,
            applicationId: invoice.applicationId as string,
            amount: Number(invoice.amount),
            currency: invoice.currency as string,
            status: invoice.status as string,
            paymentMethod: invoice.paymentMethod as string | null,
            paidAt: invoice.paidAt ? (invoice.paidAt as Date).toISOString() : null,
            externalTransactionId: invoice.externalTransactionId as string | null,
            externalIntentId: invoice.externalIntentId as string | null,
            pricingTier: invoice.pricingTier as { id: string; name: string; feeType: string },
            participant: {
                id: invoice.application.participant.id as string,
                fullName: invoice.application.participant.fullName as string,
                userId: invoice.application.participant.userId as string,
                email: (invoice.application.participant.user?.email ?? null) as string | null,
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

        } catch (e) {
            this.logger.warn(`Failed to resolve icon UUID: ${icon}. Error: ${e.message}`);
            if (e.response) {
                this.logger.warn(`Error details: ${e.response.status} ${JSON.stringify(e.response.data)}`);
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

    private handleError(error: unknown) {
        const err = error as { response?: { status: number; data: unknown }; message?: string };
        if (err.response) {
            this.logger.error(`Payment Service Error: ${err.response.status} - ${JSON.stringify(err.response.data)}`);
            throw new HttpException(err.response.data as string | Record<string, unknown>, err.response.status);
        }
        this.logger.error(`Internal Error: ${err.message}`);
        throw new HttpException(err.message ?? 'Internal server error', 500);
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
