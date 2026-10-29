// src/modules/brand-email/dto/brand-email-theme.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, IsUrl, Matches, MaxLength } from 'class-validator';

export const BUTTON_STYLES = ['rounded', 'square', 'pill'] as const;
export type ButtonStyle = (typeof BUTTON_STYLES)[number];

// Admin forms send '' for a cleared field; treat that (and null) as "unset".
const emptyToUndefined = ({ value }: { value: unknown }) =>
    value === '' || value === null ? undefined : value;

export class BrandEmailThemeDto {
    @ApiPropertyOptional({ maxLength: 60 })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsString()
    @MaxLength(60)
    fromName?: string;

    @ApiPropertyOptional({ description: 'Local part of the From address, lowercase [a-z0-9][a-z0-9.-]{0,30}' })
    @Transform(emptyToUndefined)
    @IsOptional()
    @Matches(/^[a-z0-9][a-z0-9.-]{0,30}$/, { message: 'fromLocalPart must be lowercase letters, digits, dots or hyphens (max 31 chars)' })
    fromLocalPart?: string;

    @ApiPropertyOptional()
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsEmail()
    @MaxLength(255)
    replyTo?: string;

    @ApiPropertyOptional({ description: 'https URL of the email header banner image' })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsUrl({ protocols: ['https'], require_protocol: true })
    @MaxLength(500)
    bannerUrl?: string;

    @ApiPropertyOptional({ maxLength: 500, description: 'Plain text; rendered escaped' })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsString()
    @MaxLength(500)
    footerText?: string;

    @ApiPropertyOptional({ example: '#1A73E8' })
    @Transform(emptyToUndefined)
    @IsOptional()
    @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'secondaryColor must be #RRGGBB' })
    secondaryColor?: string;

    @ApiPropertyOptional({ enum: BUTTON_STYLES })
    @Transform(emptyToUndefined)
    @IsOptional()
    @IsIn(BUTTON_STYLES)
    buttonStyle?: ButtonStyle;
}
