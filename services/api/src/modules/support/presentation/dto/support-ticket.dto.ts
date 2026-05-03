import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

export class SupportTicketAttachmentDto {
    @ApiProperty()
    @IsString()
    fileId: string;

    @ApiProperty()
    @IsString()
    fileName: string;

    @ApiProperty()
    @IsString()
    fileUrl: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    mimeType?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    uploadedAt?: string;
}

export class CreateSupportTicketDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    programId?: string;

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

    @ApiProperty({ type: [SupportTicketAttachmentDto], required: false })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SupportTicketAttachmentDto)
    attachments?: SupportTicketAttachmentDto[];

    @ApiProperty({ required: false, enum: ['low', 'normal', 'high'] })
    @IsOptional()
    @IsEnum(['low', 'normal', 'high'])
    priority?: string = 'normal';
}

export class ReplySupportTicketDto {
    @ApiProperty()
    @IsString()
    message: string;

    @ApiProperty({ type: [SupportTicketAttachmentDto], required: false })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SupportTicketAttachmentDto)
    attachments?: SupportTicketAttachmentDto[];
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

    @ApiProperty({ type: [SupportTicketAttachmentDto] })
    attachments: SupportTicketAttachmentDto[];
}

export class SupportTicketResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    ticketNumber: string;

    @ApiProperty()
    category: string;

    @ApiProperty({ required: false })
    subCategory?: string | null;

    @ApiProperty()
    subject: string;

    @ApiProperty({ required: false })
    description?: string;

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
