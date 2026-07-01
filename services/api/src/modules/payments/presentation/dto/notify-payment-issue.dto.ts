import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export const NOTIFY_PAYMENT_ISSUE_MAX_INVOICES = 500;

export class NotifyPaymentIssueDto {
    @ApiProperty({
        example: ['123e4567-e89b-12d3-a456-426614174000'],
        description: 'Invoice IDs to notify about alternative payment methods.',
        type: [String],
    })
    @IsArray()
    @ArrayNotEmpty()
    @ArrayMaxSize(NOTIFY_PAYMENT_ISSUE_MAX_INVOICES)
    @IsUUID('4', { each: true })
    invoiceIds: string[];
}
