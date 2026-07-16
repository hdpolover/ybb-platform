import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';

export class CapiUserDataDto {
    @ApiPropertyOptional({ description: 'Raw email — hashed server-side before it leaves the platform.' })
    @IsOptional()
    @IsString()
    email?: string;

    @ApiPropertyOptional({ description: 'Raw phone — hashed server-side before it leaves the platform.' })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiPropertyOptional({ description: 'Raw external ID — hashed server-side before it leaves the platform.' })
    @IsOptional()
    @IsString()
    externalId?: string;
}

export class CapiEventDto {
    @ApiProperty({ example: 'Purchase', description: 'Meta standard event name (allowlisted server-side).' })
    @IsString()
    @IsNotEmpty()
    eventName: string;

    @ApiProperty({ description: 'Client-generated event ID for Meta deduplication.' })
    @IsString()
    @IsNotEmpty()
    eventId: string;

    @ApiPropertyOptional({ description: 'URL where the event occurred.' })
    @IsOptional()
    @IsString()
    eventSourceUrl?: string;

    @ApiPropertyOptional({ description: 'Meta custom_data payload (value, currency, content_ids, etc.).' })
    @IsOptional()
    @IsObject()
    customData?: Record<string, unknown>;

    @ApiPropertyOptional({ type: CapiUserDataDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => CapiUserDataDto)
    userData?: CapiUserDataDto;

    @ApiPropertyOptional({ description: 'Meta _fbp browser cookie value.' })
    @IsOptional()
    @IsString()
    fbp?: string;

    @ApiPropertyOptional({ description: 'Meta _fbc browser cookie / click ID value.' })
    @IsOptional()
    @IsString()
    fbc?: string;
}
