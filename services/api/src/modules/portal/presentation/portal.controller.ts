import { Controller, Get, Post, Body, Param, Query, UseGuards, UnauthorizedException, BadRequestException, NotFoundException, UseInterceptors, UploadedFile, StreamableFile, Header, ForbiddenException, Logger } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Readable } from 'stream';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PortalReceiptService } from '../application/services/portal-receipt.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';
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
    CancelPortalPaymentCommand,
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
    CancelPortalPaymentResponseDto,
    PortalPaymentMethodDto,
    EnsurePortalPaymentInvoiceDto,
    EnsurePortalPaymentInvoiceResponseDto,
} from './dto/portal-payment.dto';
import { PortalDocumentResponseDto } from './dto/portal-document.dto';
import { ConfirmPortalPaymentHandler } from '../application/commands/handlers/confirm-portal-payment.handler';
import { CancelPortalPaymentHandler } from '../application/commands/handlers/cancel-portal-payment.handler';
import { EnsurePortalPaymentInvoiceHandler } from '../application/commands/handlers/ensure-portal-payment-invoice.handler';
import { PaymentServiceHttpClient } from '../../payments/infrastructure/services/payment-service-http.client';
import type { AdminPaymentMethod } from '../../payments/common/proto/payment.interface';
import { LoaDownloadService } from '../application/services/loa-download.service';
import { multerLimits } from '@common/constants';
import { currentApplicationWhere, currentApplicationOrderBy } from '../application/utils/current-application.query';

// Subset of the Go payment service's ProgramMethodView (merged, fallback-aware
// per-program payment methods response) needed to project onto PortalPaymentMethodDto.
// See services/payment/internal/domain/repositories/program_payment_method_repository.go.
interface ProgramMergedPaymentMethod {
    id: string;
    code: string;
    display_name: string;
    bank_name: string;
    account_number: string;
    account_name: string;
    instructions: string;
    icon: string;
    requires_proof: boolean;
    type: string;
}

@ApiTags('Portal')
@Controller('portal')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PortalController {
    private readonly logger = new Logger(PortalController.name);

    constructor(
        private readonly queryBus: QueryBus,
        private readonly commandBus: CommandBus,
        private readonly confirmPortalPaymentHandler: ConfirmPortalPaymentHandler,
        private readonly cancelPortalPaymentHandler: CancelPortalPaymentHandler,
        private readonly ensurePortalPaymentInvoiceHandler: EnsurePortalPaymentInvoiceHandler,
        private readonly paymentServiceClient: PaymentServiceHttpClient,
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
        private readonly receiptService: PortalReceiptService,
        private readonly loaDownloadService: LoaDownloadService,
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

        const invoice = await this.findOwnedInvoiceForDocument(id, userId);
        if (invoice.status !== 'paid' || !invoice.paidAt) {
            throw new BadRequestException('Receipt is only available for paid invoices');
        }

        const pdf = await this.receiptService.generate(this.toReceiptDocInput(invoice, 'receipt'));

        return new StreamableFile(Readable.from(pdf), {
            type: 'application/pdf',
            disposition: `attachment; filename="receipt-${invoice.id}.pdf"`,
        });
    }

    @Get('payments/:id/invoice')
    @ApiOperation({ summary: 'Download a PDF invoice for any invoice status' })
    @ApiResponse({ status: 200, description: 'PDF invoice' })
    @Header('Content-Type', 'application/pdf')
    async downloadInvoice(
        @Param('id') id: string,
        @CurrentUser() user: CurrentUserData,
    ): Promise<StreamableFile> {
        const userId = user.userId;
        if (!userId) throw new UnauthorizedException();

        const invoice = await this.findOwnedInvoiceForDocument(id, userId);

        const pdf = await this.receiptService.generate(this.toReceiptDocInput(invoice, 'invoice'));

        return new StreamableFile(Readable.from(pdf), {
            type: 'application/pdf',
            disposition: `attachment; filename="invoice-${invoice.id}.pdf"`,
        });
    }

    // Shared ownership-checked lookup for both the receipt and invoice PDF
    // downloads — same Prisma `select` so both documents get the full brand/
    // program/currency fields needed by PortalReceiptService.
    private async findOwnedInvoiceForDocument(id: string, userId: string) {
        const invoice = await this.prisma.applicationInvoice.findUnique({
            where: { id },
            include: {
                application: {
                    select: {
                        program: {
                            select: {
                                name: true,
                                logoUrl: true,
                                logoColorUrl: true,
                                contactEmail: true,
                                contactPhone: true,
                                contactAddress: true,
                                brand: {
                                    select: {
                                        name: true,
                                        logoUrl: true,
                                        primaryColor: true,
                                        websiteUrl: true,
                                    },
                                },
                            },
                        },
                        participant: {
                            select: {
                                fullName: true,
                                institution: true,
                                userId: true,
                                user: { select: { email: true } },
                            },
                        },
                    },
                },
                pricingTier: { select: { name: true, feeType: true } },
            },
        });

        if (!invoice) throw new NotFoundException('Invoice not found');
        // Ownership check — receipts/invoices are not public documents
        if (invoice.application.participant.userId !== userId) {
            throw new UnauthorizedException();
        }
        return invoice;
    }

    private toReceiptDocInput(
        invoice: Awaited<ReturnType<PortalController['findOwnedInvoiceForDocument']>>,
        docType: 'receipt' | 'invoice',
    ): Parameters<PortalReceiptService['generate']>[0] {
        const program = invoice.application.program;
        const participant = invoice.application.participant;
        const brand = program.brand;

        return {
            docType,
            invoiceId: invoice.id,
            status: invoice.status,
            amount: Number(invoice.amount),
            currency: invoice.currency,
            amountUsd: invoice.amountUsd != null ? Number(invoice.amountUsd) : null,
            amountIdr: invoice.amountIdr != null ? Number(invoice.amountIdr) : null,
            exchangeRateSnapshot: invoice.exchangeRateSnapshot != null ? Number(invoice.exchangeRateSnapshot) : null,
            feeProvider: invoice.feeProvider != null ? Number(invoice.feeProvider) : null,
            paidAt: invoice.paidAt,
            createdAt: invoice.createdAt,
            transactionReference: invoice.externalTransactionId ?? null,
            paymentMethod: invoice.paymentMethod ?? null,
            customerName: participant.fullName,
            customerEmail: participant.user.email ?? null,
            customerInstitution: participant.institution ?? null,
            programName: program.name,
            programLogoUrl: program.logoUrl ?? null,
            programLogoColorUrl: program.logoColorUrl ?? null,
            pricingTierName: invoice.pricingTier.name ?? null,
            feeType: invoice.pricingTier.feeType ?? null,
            brand: brand
                ? {
                      name: brand.name,
                      logoUrl: brand.logoUrl ?? null,
                      primaryColor: brand.primaryColor ?? null,
                      contactEmail: program.contactEmail ?? null,
                      contactPhone: program.contactPhone ?? null,
                      contactAddress: program.contactAddress ?? null,
                      websiteUrl: brand.websiteUrl ?? null,
                  }
                : null,
        };
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
                    proofFileId: dto.proof_file_id,
                    proofFileUrl: dto.proof_file_url,
                    gatewayToken: dto.gateway_token,
                },
            ),
        );
    }

    @Post('payments/:id/cancel')
    @ApiOperation({ summary: 'Cancel a pending payment for an invoice' })
    @ApiResponse({ status: 200, type: CancelPortalPaymentResponseDto })
    async cancelPayment(
        @Param('id') id: string,
        @CurrentUser() user: CurrentUserData,
    ): Promise<CancelPortalPaymentResponseDto> {
        const userId = user.userId;
        if (!userId) throw new UnauthorizedException();
        return this.cancelPortalPaymentHandler.execute(
            new CancelPortalPaymentCommand(userId, id, 'Cancelled by participant'),
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
    async getPaymentMethods(
        @CurrentUser() user: CurrentUserData,
        @Query('programId') queryProgramId?: string,
    ): Promise<PortalPaymentMethodDto[]> {
        try {
            const programId = queryProgramId?.trim() || (await this.resolveCurrentProgramId(user.userId));

            if (programId) {
                try {
                    return await this.getProgramPaymentMethods(programId);
                } catch (error) {
                    // Go-side fallback contract makes this safe: an unconfigured/
                    // unresolvable program just gets today's global behavior.
                    this.logger.warn(
                        `Falling back to global payment methods for program ${programId}: ${(error as Error).message}`,
                    );
                }
            }

            return await this.getGlobalPaymentMethods();
        } catch {
            return [];
        }
    }

    // Resolves the participant's current program (participant -> current
    // participantApplication.programId). The payment-methods route has no
    // invoiceId/applicationId param of its own, so this lookup is the fallback
    // when the caller does not pass ?programId= explicitly - the same optional
    // param GET /portal/payments and GET /portal/submissions already accept.
    //
    // Uses the shared rule rather than a bare findFirst: this used to take
    // whichever row Postgres returned, so a multi-program participant could be
    // offered another program's payment methods.
    private async resolveCurrentProgramId(userId: string): Promise<string | null> {
        const participant = await this.prisma.participant.findUnique({
            where: { userId },
            select: { id: true },
        });
        if (!participant) return null;

        const application = await this.prisma.participantApplication.findFirst({
            where: currentApplicationWhere(participant.id),
            orderBy: currentApplicationOrderBy,
            select: { programId: true },
        });
        return application?.programId ?? null;
    }

    private async getGlobalPaymentMethods(): Promise<PortalPaymentMethodDto[]> {
        const internalKey = this.configService.get<string>('PAYMENT_SERVICE_INTERNAL_KEY', '');
        const headers = internalKey ? { 'X-Internal-Service-Key': internalKey } : {};
        const { data } = await this.paymentServiceClient.get<AdminPaymentMethod[] | { data: AdminPaymentMethod[] }>(
            '/api/v1/payment-methods',
            // `available_only=true` makes the Go service drop automatic methods whose
            // gateway provider isn't registered, so participants don't see options that
            // would fail at confirm-time.
            { params: { is_active: true, available_only: true }, headers },
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
    }

    // Merged (fallback-aware) per-program list. Already filtered server-side to
    // only the visible/enabled set (see FindMergedByProgram in
    // program_payment_method_repository.go), so no further is_active/is_enabled
    // filtering is needed here.
    // `available_only=true` mirrors getGlobalPaymentMethods() below: manual
    // methods are always included, automatic methods only if their gateway
    // provider is registered/live, so participants don't see options that
    // would fail at confirm-time.
    private async getProgramPaymentMethods(programId: string): Promise<PortalPaymentMethodDto[]> {
        const internalKey = this.configService.get<string>('PAYMENT_SERVICE_INTERNAL_KEY', '');
        const headers = internalKey ? { 'X-Internal-Service-Key': internalKey } : {};
        const { data } = await this.paymentServiceClient.get<
            ProgramMergedPaymentMethod[] | { data: ProgramMergedPaymentMethod[] }
        >(`/api/v1/programs/${programId}/payment-methods`, { params: { available_only: true }, headers });
        const methods: ProgramMergedPaymentMethod[] = Array.isArray(data)
            ? data
            : ((data as { data?: ProgramMergedPaymentMethod[] })?.data ?? []);
        return methods.map(m => ({
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
    }

    @Get('documents')
    @ApiOperation({ summary: 'Get program resources and my documents' })
    @ApiResponse({ status: 200, type: PortalDocumentResponseDto })
    @ApiQuery({ name: 'programId', required: false, description: 'Defaults to the current application when omitted' })
    async getDocuments(
        @CurrentUser() user: CurrentUserData,
        @Query('programId') programId?: string,
    ): Promise<PortalDocumentResponseDto> {
        const userId = user.userId;
        if (!userId) throw new UnauthorizedException();
        return this.queryBus.execute(new GetPortalDocumentsQuery(userId, programId));
    }

    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Get('loa/download')
    @Header('Content-Type', 'application/pdf')
    @ApiOperation({ summary: 'Download the participant LOA PDF on-demand (gated by release batch)' })
    @ApiResponse({ status: 200, description: 'PDF binary stream' })
    @ApiResponse({ status: 403, description: 'Not eligible — no released batch covers this participant' })
    async downloadLoa(@CurrentUser() user: CurrentUserData): Promise<StreamableFile> {
        const { userId, brandId } = user;
        if (!userId) throw new UnauthorizedException();

        const { buffer, filename } = await this.loaDownloadService.downloadLoa(userId, brandId);

        return new StreamableFile(buffer, {
            type: 'application/pdf',
            disposition: `attachment; filename="${filename}"`,
        });
    }

    @Post('documents/:templateId/signed-copy')
    @UseInterceptors(FileInterceptor('file', multerLimits()))
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
