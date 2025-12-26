import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';

export class CreateSupportTicketDto {
    @ApiProperty()
    @IsString()
    category: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    subCategory?: string;

    @ApiProperty()
    @IsString()
    subject: string;

    @ApiProperty()
    @IsString()
    description: string;

    @ApiProperty({ required: false, enum: ['low', 'normal', 'high'] })
    @IsOptional()
    @IsEnum(['low', 'normal', 'high'])
    priority?: string = 'normal';
}

export class ReplySupportTicketDto {
    @ApiProperty()
    @IsString()
    message: string;

    @ApiProperty({ required: false })
    @IsOptional()
    attachments?: any[];
}

export class SupportTicketMessageResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    message: string;

    @ApiProperty()
    isFromAdmin: boolean;

    @ApiProperty()
    senderName: string;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    attachments: any[];
}

export class SupportTicketResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    ticketNumber: string;

    @ApiProperty()
    category: string;

    @ApiProperty()
    subject: string;

    @ApiProperty()
    status: string;

    @ApiProperty()
    priority: string;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;

    @ApiProperty({ type: [SupportTicketMessageResponseDto], required: false })
    messages?: SupportTicketMessageResponseDto[];
}
