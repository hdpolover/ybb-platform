import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString, IsBoolean, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProgramDto {
    @ApiProperty({ description: 'Brand ID' })
    @IsUUID()
    @IsNotEmpty()
    brandId: string;

    @ApiProperty({ description: 'Program name' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ description: 'Program slug', required: false })
    @IsString()
    @IsOptional()
    slug?: string;

    @ApiProperty({ description: 'Program description', required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ description: 'Program year' })
    @IsNumber()
    @IsNotEmpty()
    year: number;

    @ApiProperty({ description: 'Start date' })
    @IsDateString()
    @IsNotEmpty()
    startDate: string;

    @ApiProperty({ description: 'End date' })
    @IsDateString()
    @IsNotEmpty()
    endDate: string;

    @ApiProperty({ description: 'Application deadline' })
    @IsDateString()
    @IsNotEmpty()
    applicationDeadline: string;

    @ApiProperty({ description: 'Location', required: false })
    @IsString()
    @IsOptional()
    location?: string;

    @ApiProperty({ description: 'Capacity', required: false })
    @IsNumber()
    @IsOptional()
    capacity?: number;
}
