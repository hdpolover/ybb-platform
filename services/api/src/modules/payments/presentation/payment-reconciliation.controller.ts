import { Controller, Post, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import {
    PaymentReconciliationService,
    ReconcileReport,
} from '../infrastructure/services/payment-reconciliation.service';

const DEFAULT_GRACE_MINUTES = 1440;

@ApiTags('Admin Payments')
@Controller('admin/payments/reconciliation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class PaymentReconciliationController {
    private readonly logger = new Logger(PaymentReconciliationController.name);

    constructor(private readonly reconciliationService: PaymentReconciliationService) {}

    @Post('reconcile')
    @ApiOperation({
        summary: 'Reconcile processing invoices against the payment service (Super Admin)',
    })
    @ApiQuery({
        name: 'apply',
        required: false,
        description: 'true = write changes + emit emails; false (default) = dry run',
    })
    @ApiQuery({
        name: 'graceMinutes',
        required: false,
        description: 'Minutes an abandoned intent must be idle before reverting (default 1440)',
    })
    async reconcile(
        @Query('apply') apply?: string,
        @Query('graceMinutes') graceMinutes?: string,
    ): Promise<ReconcileReport> {
        const shouldApply = parseBoolQuery(apply, false);
        const grace = parsePositiveIntQuery(graceMinutes, DEFAULT_GRACE_MINUTES);

        this.logger.log(
            `[payment-reconciliation] admin trigger apply=${shouldApply} graceMinutes=${grace}`,
        );

        return this.reconciliationService.reconcileProcessingInvoices({
            apply: shouldApply,
            graceMinutes: grace,
        });
    }
}

function parseBoolQuery(value: string | undefined, defaultValue: boolean): boolean {
    if (value === undefined) return defaultValue;
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function parsePositiveIntQuery(value: string | undefined, defaultValue: number): number {
    if (value === undefined) return defaultValue;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : defaultValue;
}
