import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ResendReceiptDto {
    @ApiProperty({
        example: '123e4567-e89b-12d3-a456-426614174000',
        description: 'Invoice to (re)send the receipt PDF email for. Must be paid.',
    })
    @IsUUID('4')
    invoiceId: string;
}
