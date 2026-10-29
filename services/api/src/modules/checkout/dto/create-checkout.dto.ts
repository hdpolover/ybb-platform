// services/api/src/modules/checkout/dto/create-checkout.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationCategory } from '@prisma/client';
import { Equals, IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { NormalizeEmail } from '@shared/decorators/normalize-email.decorator';
import { IsEnglishName } from '@shared/validators/english-text.validator';

export class CreateCheckoutDto {
    @ApiProperty({ example: 'meys-7' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    programSlug!: string;

    @ApiProperty()
    @IsUUID()
    tierId!: string;

    @ApiProperty({ enum: ApplicationCategory })
    @IsEnum(ApplicationCategory)
    category!: ApplicationCategory;

    @ApiProperty({ example: 'user@example.com' })
    @NormalizeEmail()
    @IsEmail()
    @IsNotEmpty()
    email!: string;

    // Same rules as RegisterDto.password (required here; there it is optional for OAuth).
    @ApiProperty({ minLength: 8 })
    @IsString()
    @MinLength(8)
    @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*[\d\W]).+$/, {
        message: 'Password must contain uppercase, lowercase, number/special character',
    })
    password!: string;

    // Same rule and column width as OnboardingDto.fullName.
    @ApiProperty({ example: 'John Doe' })
    @IsString()
    @IsNotEmpty()
    @IsEnglishName()
    @MaxLength(255)
    fullName!: string;

    @ApiProperty({ description: 'Terms, Privacy Policy and refund terms accepted. Must be true.' })
    @Equals(true, { message: 'You must accept the terms, privacy policy and refund terms' })
    consent!: boolean;

    @ApiPropertyOptional({ description: 'Optional, unticked-by-default opt-in to marketing emails.' })
    @IsOptional()
    @IsBoolean()
    marketingOptIn?: boolean;

    @ApiProperty({ description: 'Cloudflare Turnstile response token' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(2048)
    turnstileToken!: string;
}
