import { ApiProperty } from '@nestjs/swagger';

export class PaymentItemDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    title: string;

    @ApiProperty()
    amount: number;

    @ApiProperty()
    currency: string;

    @ApiProperty({ enum: ['pending', 'paid', 'failed', 'due', 'cancelled'] })
    status: string;

    @ApiProperty()
    dueDate?: Date;

    @ApiProperty()
    paidAt?: Date;

    @ApiProperty()
    paymentMethod?: string;
    
    @ApiProperty({ description: 'URL for payment or invoice' })
    actionUrl?: string;
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
    type: string; // registration_fee, program_fee, merch
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
    }
}
