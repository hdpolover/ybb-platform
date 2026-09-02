import { Controller, Post, Body, Get, Query, Param, UseGuards, Req, BadRequestException, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentGrpcClient } from '../services/payment-grpc.client';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { SubmitManualPaymentDto, VerifyManualPaymentDto, AdminListPaymentsDto } from './dto/payment.dto';
import { Request } from 'express';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';

interface JwtPayload { sub: string; email?: string; }

@ApiTags('Payments')
@Controller('infra/payments') // Renamed to avoid conflict with CQRS controller
@ApiBearerAuth()
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly paymentClient: PaymentGrpcClient,
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  @Post('manual')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Submit Manual Payment Proof' })
  async submitManualPayment(@Body() dto: SubmitManualPaymentDto, @Req() req: Request) {
      return this.paymentClient.submitManualPayment({
          intent_id: dto.intent_id,
          proof_file_id: dto.proof_file_id,
          proof_file_url: dto.proof_file_url,
          details: dto.details
      });
  }

  @Post('manual/:id/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Verify Manual Payment (Admin)' })
  async verifyManualPayment(@Param('id') transactionId: string, @Body() dto: VerifyManualPaymentDto, @Req() req: Request) {
      const adminId = (req.user as JwtPayload).sub;

      const result = await this.paymentClient.verifyManualPayment({
          transaction_id: transactionId,
          status: dto.status,
          admin_id: adminId,
          reason: dto.reason
      });

      // Invalidate participant portal caches — look up invoice by externalTransactionId
      const invoice = await this.prisma.applicationInvoice.findFirst({
          where: { externalTransactionId: transactionId },
          select: {
              id: true,
              application: {
                  select: {
                      participant: { select: { userId: true } },
                  },
              },
          },
      });
      const participantUserId = invoice?.application?.participant?.userId;
      if (invoice && participantUserId) {
          await this.cacheService.invalidateInvoiceCache(invoice.id, participantUserId);
      }

      return result;
  }

  @Get('admin/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List Payments (Admin)' })
  async adminListPayments(@Query() query: AdminListPaymentsDto) {
      return this.paymentClient.adminListPayments({
          page: query.page || 1,
          limit: query.limit || 10,
          user_id: query.user_id,
          program_id: query.program_id,
          status: query.status,
          from_date: query.from_date,
          to_date: query.to_date
      });
  }

  @Get('methods')
  @ApiOperation({ summary: 'Get Payment Methods' })
  async getMethods(@Query('amount') amount: number, @Query('currency') currency: string) {
      return this.paymentClient.getPaymentMethods({
          amount: Number(amount),
          currency: currency || 'IDR'
      });
  }

  @Get('by-reference/:type/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get Intents by Reference' })
  async getByReference(@Param('type') type: string, @Param('id') id: string) {
      return this.paymentClient.getIntentsByReference({
          reference_type: type,
          reference_id: id
      });
  }
}
