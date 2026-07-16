import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsUUID, IsArray } from 'class-validator';

export class CreateEmailTemplateDto {
    @ApiProperty({ example: 'Application Received - YBB 2024', description: 'Internal template name' })
    @IsString()
    name: string;

    @ApiProperty({ example: 'application_received', description: 'Template type (e.g., welcome, application_received, accepted, rejected, payment_reminder)' })
    @IsString()
    type: string;

    @ApiProperty({ example: 'Your application for {{program_name}} has been received', description: 'Email subject line' })
    @IsString()
    subject: string;

    @ApiProperty({ example: '<p>Dear {{name}},</p>...', description: 'HTML email body content' })
    @IsString()
    body: string;

    @ApiProperty({ example: ['{{name}}', '{{program_name}}'], description: 'List of template variables', required: false })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    variables?: string[];

    @ApiProperty({ example: 'uuid-of-brand', description: 'Brand this template belongs to', required: false })
    @IsOptional()
    @IsUUID()
    brandId?: string;

    @ApiProperty({ example: 'uuid-of-program', description: 'Program this template belongs to', required: false })
    @IsOptional()
    @IsUUID()
    programId?: string;

    @ApiProperty({ example: true, description: 'Whether the template is active', required: false })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
