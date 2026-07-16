import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class CreateLegalDocumentDto {
    @ApiProperty({ example: 'Terms of Service', description: 'Title of the legal document' })
    @IsString()
    title: string;

    @ApiProperty({ example: 'terms-of-service', description: 'URL-friendly identifier' })
    @IsString()
    slug: string;

    @ApiProperty({ example: '<h1>Terms</h1>...', description: 'HTML or Markdown content' })
    @IsString()
    content: string;

    @ApiProperty({ example: '1.0', description: 'Version number', required: false })
    @IsOptional()
    @IsString()
    version?: string;

    @ApiProperty({ example: 'Main terms', description: 'Internal description', required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ example: true, description: 'Is acceptance required?', required: false })
    @IsOptional()
    @IsBoolean()
    isRequired?: boolean;

    @ApiProperty({ example: true, description: 'Is document active?', required: false })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
