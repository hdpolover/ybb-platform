import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class PortalPaymentMethodDto {
    @ApiProperty() id: string;
    @ApiProperty() code: string;
    @ApiProperty() display_name: string;
    @ApiProperty() bank_name: string;
    @ApiProperty() account_number: string;
    @ApiProperty() account_name: string;
    @ApiProperty() instructions: string;
    @ApiProperty() icon: string;
    @ApiProperty() requires_proof: boolean;
    @ApiProperty() type: string;
}

export class PaymentItemDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    title: string;

    @ApiProperty()
    amount: number;

    @ApiProperty()
    currency: string;

    @ApiProperty({ enum: ['unpaid', 'processing', 'paid', 'failed', 'due', 'cancelled', 'pending'] })
    status: string;

    @ApiProperty()
    dueDate?: Date;

    @ApiProperty()
    paidAt?: Date;

    @ApiProperty()
    paymentMethod?: string;

    @ApiProperty({ description: 'URL for payment or invoice' })
    actionUrl?: string;

    @ApiPropertyOptional({ description: 'Pricing fee type, e.g. registration_fee or full_fee' })
    type?: string;

    @ApiPropertyOptional()
    pricingTierId?: string;

    @ApiPropertyOptional({ description: 'Tier visibility start date' })
    startDate?: Date;

    @ApiPropertyOptional({ description: 'Ordering hint from pricing tier' })
    sequenceOrder?: number;
}

export class AvailablePaymentDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    title: string;

    @ApiProperty()
    description: string;

    @ApiProperty()
    amount: number;

    @ApiProperty()
    currency: string;

    @ApiProperty()
    type: string;

    @ApiPropertyOptional({ description: 'Tier visibility start date' })
    startDate?: Date;

    @ApiPropertyOptional({ description: 'Ordering hint from pricing tier' })
    sequenceOrder?: number;
}

export class PortalPaymentResponseDto {
    @ApiProperty({ type: [PaymentItemDto] })
    history: PaymentItemDto[];

    @ApiProperty({ type: [PaymentItemDto] })
    outstanding: PaymentItemDto[];

    @ApiProperty({ type: [AvailablePaymentDto] })
    availableMethods: AvailablePaymentDto[];

    @ApiProperty()
    stats: {
        totalPaid: number;
        totalDue: number;
        currency: string;
    };
}

// --- Payment Detail ---

export class PaymentHistoryEntryDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    method: string;

    @ApiProperty()
    amount: number;

    @ApiProperty()
    date: string;

    @ApiProperty()
    time: string;

    @ApiProperty({ enum: ['cancelled', 'failed', 'processing', 'paid'] })
    status: 'cancelled' | 'failed' | 'processing' | 'paid';

    @ApiProperty()
    note: string;

    @ApiPropertyOptional()
    code?: string;

    @ApiPropertyOptional()
    paymentMethod?: string;

    @ApiPropertyOptional()
    dateTime?: string;

    @ApiPropertyOptional()
    accountName?: string;

    @ApiPropertyOptional()
    amountLabel?: string;
}

export class PaymentInvoiceDetailDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    label: string;

    @ApiProperty()
    category: string;

    @ApiProperty()
    amount: number;

    @ApiPropertyOptional()
    dueDate?: string;

    @ApiProperty({ enum: ['paid', 'unpaid', 'processing', 'failed'] })
    status: string;

    @ApiProperty()
    currency: string;
}

export class PortalPaymentDetailResponseDto {
    @ApiProperty()
    invoice: PaymentInvoiceDetailDto;

    @ApiProperty({ type: [PaymentHistoryEntryDto] })
    history: PaymentHistoryEntryDto[];
}

// --- Confirm Payment ---

export class ConfirmPortalPaymentDto {
    @ApiProperty({ enum: ['gateway', 'manual'] })
    @IsString()
    @IsNotEmpty()
    @IsIn(['gateway', 'manual'])
    payment_type: 'gateway' | 'manual';

    @ApiProperty({ description: 'Payment method ID, e.g. bca, bni, credit_card, virtual_account' })
    @IsString()
    @IsNotEmpty()
    payment_method_id: string;

    @ApiPropertyOptional({ description: 'Payer account/holder name (manual only)' })
    @IsString()
    @IsOptional()
    account_name?: string;

    @ApiPropertyOptional({ description: 'Source bank or account (manual only)' })
    @IsString()
    @IsOptional()
    source_name?: string;

    @ApiPropertyOptional({ description: 'Date payment was made, ISO string (manual only)' })
    @IsString()
    @IsOptional()
    payment_date?: string;

    @ApiPropertyOptional({ description: 'Additional notes (manual only)' })
    @IsString()
    @IsOptional()
    notes?: string;

    @ApiPropertyOptional({ description: 'Token from gateway JS SDK (gateway only)' })
    @IsString()
    @IsOptional()
    gateway_token?: string;
}

export class ConfirmPortalPaymentResponseDto {
    @ApiProperty({ enum: ['PROCESSING', 'REQUIRES_ACTION', 'SUCCEEDED', 'FAILED'] })
    status: string;

    @ApiProperty()
    invoice_id: string;

    @ApiPropertyOptional()
    intent_id?: string;

    @ApiPropertyOptional({ description: 'Next action for gateway payments' })
    action?: {
        type: 'redirect' | 'checkout';
        url: string;
    };

    @ApiProperty()
    message: string;
}
