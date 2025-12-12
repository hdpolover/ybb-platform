import { ApiProperty } from '@nestjs/swagger';

export class PaymentResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    applicationId: string;

    @ApiProperty()
    amount: number;

    @ApiProperty()
    currency: string;

    @ApiProperty()
    status: string;

    @ApiProperty()
    paymentType: string;

    @ApiProperty({ required: false })
    paymentMethod?: string;

    @ApiProperty({ required: false })
    paidAt?: Date;

    @ApiProperty()
    createdAt: Date;
}
