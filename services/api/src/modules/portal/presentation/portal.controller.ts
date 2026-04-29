import { Controller, Get, Post, Body, Param, Query, UseGuards, UnauthorizedException, BadRequestException, NotFoundException, UseInterceptors, UploadedFile, StreamableFile, Header } from '@nestjs/common';
import { Readable } from 'stream';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PortalReceiptService } from '../application/services/portal-receipt.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { QueryBus, CommandBus } from '@nestjs/cqrs';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';
import {
    GetPortalDashboardQuery,
    GetPortalSubmissionsQuery,
    GetPortalPaymentsQuery,
    GetPortalPaymentDetailQuery,
    GetPortalDocumentsQuery,
    ConfirmPortalPaymentCommand,
    EnsurePortalPaymentInvoiceCommand,
    UploadSignedCopyCommand,
} from '../application/queries/portal-queries';
import { PortalDashboardResponseDto } from './dto/portal-dashboard.dto';
import { PortalSubmissionResponseDto } from './dto/portal-submission.dto';
import {
    PortalPaymentResponseDto,
    PortalPaymentDetailResponseDto,
    ConfirmPortalPaymentDto,
    ConfirmPortalPaymentResponseDto,
    PortalPaymentMethodDto,
    EnsurePortalPaymentInvoiceDto,
    EnsurePortalPaymentInvoiceResponseDto,
} from './dto/portal-payment.dto';
import { PortalDocumentResponseDto } from './dto/portal-document.dto';
import { ConfirmPortalPaymentHandler } from '../application/commands/handlers/confirm-portal-payment.handler';
import { EnsurePortalPaymentInvoiceHandler } from '../application/commands/handlers/ensure-portal-payment-invoice.handler';
import { PaymentServiceHttpClient } from '../../payments/infrastructure/services/payment-service-http.client';
import type { AdminPaymentMethod } from '../../payments/common/proto/payment.interface';

@ApiTags('Portal')
@Controller('portal')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PortalController {
    constructor(
        private readonly queryBus: QueryBus,
        private readonly commandBus: CommandBus,
        private readonly confirmPortalPaymentHandler: ConfirmPortalPaymentHandler,
        private readonly ensurePortalPaymentInvoiceHandler: EnsurePortalPaymentInvoiceHandler,
        private readonly paymentServiceClient: PaymentServiceHttpClient,
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
        private readonly receiptService: PortalReceiptService,
    ) {}

    @Get('dashboard')
    @ApiOperation({ summary: 'Get participant dashboard summary' })
    @ApiResponse({ status: 200, type: PortalDashboardResponseDto })
    async getDashboard(@CurrentUser() user: CurrentUserData): Promise<PortalDashboardResponseDto> {
        const userId = user.userId;
        if (!userId) throw new UnauthorizedException();
        return this.queryBus.execute(new GetPortalDashboardQuery(userId));
    }

    @Get('submissions')
    @ApiOperation({ summary: 'Get application submission progress' })
    @ApiResponse({ status: 200, type: PortalSubmissionResponseDto })
    async getSubmissions(
        @CurrentUser() user: CurrentUserData,
        @Query('programId') programId?: string,
    ): Promise<PortalSubmissionResponseDto> {
        const userId = user.userId;
        if (!userId) throw new UnauthorizedException();
        return this.queryBus.execute(new GetPortalSubmissionsQuery(userId, programId));
    }

    @Get('payments')
    @ApiOperation({ summary: 'Get payment history and outstanding items' })
    @ApiResponse({ status: 200, type: PortalPaymentResponseDto })
    async getPayments(
        @CurrentUser() user: CurrentUserData,
        @Query('programId') programId?: string,
    ): Promise<PortalPaymentResponseDto> {
        const userId = user.userId;
        if (!userId) throw new UnauthorizedException();
        return this.queryBus.execute(new GetPortalPaymentsQuery(userId, programId));
    }

    @Get('payments/:id')
    @ApiOperation({ summary: 'Get payment invoice detail with transaction history' })
    @ApiResponse({ status: 200, type: PortalPaymentDetailResponseDto })
    async getPaymentDetail(
        @Param('id') id: string,
        @CurrentUser() user: CurrentUserData,
    ): Promise<PortalPaymentDetailResponseDto> {
        const userId = user.userId;
        if (!userId) throw new UnauthorizedException();
        return this.queryBus.execute(new GetPortalPaymentDetailQuery(userId, id));
    }

    @Get('payments/:id/receipt')
    @ApiOperation({ summary: 'Download a PDF receipt for a paid invoice' })
    @ApiResponse({ status: 200, description: 'PDF receipt' })
    @Header('Content-Type', 'application/pdf')
    async downloadReceipt(
        @Param('id') id: string,
        @CurrentUser() user: CurrentUserData,
    ): Promise<StreamableFile> {
        const userId = user.userId;
        if (!userId) throw new UnauthorizedException();

        const invoice = await this.prisma.applicationInvoice.findUnique({
            where: { id },
            include: {
                application: {
                    select: {
                        program: { select: { name: true, brand: { select: { name: true } } } },
                        participant: {
                            select: {
                                fullName: true,
                                userId: true,
                                user: { select: { email: true } },
                            },
                        },
                    },
                },
                pricingTier: { select: { name: true } },
            },
        });

        if (!invoice) throw new NotFoundException('Invoice not found');
        // Ownership check — receipt is not a public document
        if (invoice.application.participant.userId !== userId) {
            throw new UnauthorizedException();
        }
        if (invoice.status !== 'paid' || !invoice.paidAt) {
            throw new BadRequestException('Receipt is only available for paid invoices');
        }

        const pdf = await this.receiptService.generate({
            receiptNumber: `R-${invoice.id.slice(0, 8).toUpperCase()}`,
            invoiceId: invoice.id,
            transactionId: invoice.externalTransactionId ?? undefined,
            amount: Number(invoice.amount),
            currency: invoice.currency,
            paidAt: invoice.paidAt,
            customerName: invoice.application.participant.fullName,
            customerEmail: invoice.application.participant.user.email,
            description: invoice.pricingTier.name,
            programName: invoice.application.program.name,
            paymentMethod: invoice.paymentMethod ?? undefined,
            brandName: invoice.application.program.brand?.name,
        });

        return new StreamableFile(Readable.from(pdf), {
            type: 'application/pdf',
            disposition: `attachment; filename="receipt-${invoice.id}.pdf"`,
        });
    }

    @Post('payments/:id/confirm')
    @ApiOperation({ summary: 'Submit payment for an invoice (gateway or manual)' })
    @ApiResponse({ status: 200, type: ConfirmPortalPaymentResponseDto })
    async confirmPayment(
        @Param('id') id: string,
        @Body() dto: ConfirmPortalPaymentDto,
        @CurrentUser() user: CurrentUserData,
    ): Promise<ConfirmPortalPaymentResponseDto> {
        const userId = user.userId;
        if (!userId) throw new UnauthorizedException();
        return this.confirmPortalPaymentHandler.execute(
            new ConfirmPortalPaymentCommand(
                userId,
                id,
                dto.payment_type,
                dto.payment_method_id,
                {
                    accountName: dto.account_name,
                    sourceName: dto.source_name,
                    paymentDate: dto.payment_date,
                    notes: dto.notes,
                    gatewayToken: dto.gateway_token,
                },
            ),
        );
    }

    @Post('payments/tiers/:tierId/ensure-invoice')
    @ApiOperation({ summary: 'Ensure invoice exists for selected program payment option' })
    @ApiResponse({ status: 200, type: EnsurePortalPaymentInvoiceResponseDto })
    async ensurePaymentInvoice(
        @Param('tierId') tierId: string,
        @Body() dto: EnsurePortalPaymentInvoiceDto,
        @CurrentUser() user: CurrentUserData,
    ): Promise<EnsurePortalPaymentInvoiceResponseDto> {
        const userId = user.userId;
        if (!userId) throw new UnauthorizedException();

        return this.ensurePortalPaymentInvoiceHandler.execute(
            new EnsurePortalPaymentInvoiceCommand(userId, tierId, dto.program_id),
        );
    }

    @Get('payment-methods')
    @ApiOperation({ summary: 'Get available manual payment methods for participants' })
    @ApiResponse({ status: 200, type: [PortalPaymentMethodDto] })
    async getPaymentMethods(): Promise<PortalPaymentMethodDto[]> {
        try {
            const internalKey = this.configService.get<string>('PAYMENT_SERVICE_INTERNAL_KEY', '');
            const headers = internalKey ? { 'X-Internal-Service-Key': internalKey } : {};
            const { data } = await this.paymentServiceClient.get<AdminPaymentMethod[] | { data: AdminPaymentMethod[] }>(
                '/api/v1/payment-methods',
                { params: { is_active: true }, headers },
            );
            const methods: AdminPaymentMethod[] = Array.isArray(data) ? data : ((data as { data?: AdminPaymentMethod[] })?.data ?? []);
            return methods
                .filter(m => m.is_active)
                .map(m => ({
                    id: m.id,
                    code: m.code,
                    display_name: m.display_name,
                    bank_name: m.bank_name,
                    account_number: m.account_number,
                    account_name: m.account_name,
                    instructions: m.instructions,
                    icon: m.icon,
                    requires_proof: m.requires_proof,
                    type: m.type,
                }));
        } catch {
            return [];
        }
    }

    @Get('documents')
    @ApiOperation({ summary: 'Get program resources and my documents' })
    @ApiResponse({ status: 200, type: PortalDocumentResponseDto })
    async getDocuments(@CurrentUser() user: CurrentUserData): Promise<PortalDocumentResponseDto> {
        const userId = user.userId;
        if (!userId) throw new UnauthorizedException();
        return this.queryBus.execute(new GetPortalDocumentsQuery(userId));
    }

    @Post('documents/:templateId/signed-copy')
    @UseInterceptors(FileInterceptor('file'))
    @ApiConsumes('multipart/form-data')
    @ApiOperation({ summary: 'Upload signed copy of an agreement letter' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: { type: 'string', format: 'binary' },
            },
            required: ['file'],
        },
    })
    async uploadSignedCopy(
        @Param('templateId') templateId: string,
        @UploadedFile() file: Express.Multer.File,
        @CurrentUser() user: CurrentUserData,
    ) {
        if (!user.userId) throw new UnauthorizedException();
        if (!file) throw new BadRequestException('File is required');
        return this.commandBus.execute(
            new UploadSignedCopyCommand(templateId, user.userId, file),
        );
    }
}
