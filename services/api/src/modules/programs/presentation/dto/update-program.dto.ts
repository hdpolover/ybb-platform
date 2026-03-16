import { IsString, IsOptional, IsNumber, IsDateString, IsBoolean, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProgramDto {
    @ApiProperty({ description: 'Brand ID', required: false })
    @IsUUID()
    @IsOptional()
    brandId?: string;

    @ApiProperty({ description: 'Program name', required: false })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiProperty({ description: 'Program slug', required: false })
    @IsString()
    @IsOptional()
    slug?: string;

    @ApiProperty({ description: 'Program description', required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ description: 'Program year', required: false })
    @IsNumber()
    @IsOptional()
    year?: number;

    @ApiProperty({ description: 'Start date', required: false })
    @IsDateString()
    @IsOptional()
    startDate?: string;

    @ApiProperty({ description: 'End date', required: false })
    @IsDateString()
    @IsOptional()
    endDate?: string;

    @ApiProperty({ description: 'Application deadline', required: false })
    @IsDateString()
    @IsOptional()
    applicationDeadline?: string;

    @ApiProperty({ description: 'Location', required: false })
    @IsString()
    @IsOptional()
    location?: string;

    @ApiProperty({ description: 'Capacity', required: false })
    @IsNumber()
    @IsOptional()
    capacity?: number;

    @ApiProperty({ description: 'Program status', required: false, example: 'draft' })
    @IsString()
    @IsOptional()
    status?: string;

    @ApiProperty({ description: 'Publish program immediately', required: false })
    @IsBoolean()
    @IsOptional()
    isPublished?: boolean;

    @ApiProperty({ description: 'Registration open date', required: false })
    @IsDateString()
    @IsOptional()
    registrationOpenDate?: string;

    @ApiProperty({ description: 'Registration close date', required: false })
    @IsDateString()
    @IsOptional()
    registrationCloseDate?: string;

    @ApiProperty({ description: 'Registration fee', required: false })
    @IsNumber()
    @IsOptional()
    registrationFee?: number;

    @ApiProperty({ description: 'Is active', required: false })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @ApiProperty({ description: 'Is fully funded', required: false })
    @IsBoolean()
    @IsOptional()
    isFullyFunded?: boolean;
}
