import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateDeletionRequestDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    reason?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    reasonCategory?: string;
}

export class DeletionRequestResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    status: string;

    @ApiPropertyOptional()
    reason?: string;

    @ApiPropertyOptional()
    reasonCategory?: string;

    @ApiProperty()
    createdAt: Date;
}
