import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateSupportAccessConfigDto {
  @ApiProperty({ required: false, description: 'Enable or disable admin support access impersonation.' })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiProperty({
    required: false,
    description: 'Optional new support secret. Must be at least 12 chars and include upper, lower, number, and symbol.',
  })
  @IsOptional()
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: 'Support secret must include upper, lower, number, and symbol.',
  })
  newSecret?: string;
}

export class CreateSupportImpersonationDto {
  @ApiProperty({ required: false, description: 'Participant ID (UUID).' })
  @IsOptional()
  @IsString()
  participantId?: string;

  @ApiProperty({ required: false, description: 'Participant email (fallback identifier).' })
  @IsOptional()
  @IsString()
  participantEmail?: string;

  @ApiProperty({ required: false, description: 'Program ID to narrow participant resolution.' })
  @IsOptional()
  @IsString()
  programId?: string;

  @ApiProperty({ description: 'Support secret configured in platform settings.' })
  @IsString()
  supportSecret!: string;

  @ApiProperty({ description: 'Reason for impersonation (for strict audit).' })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}

export class ExchangeSupportImpersonationDto {
  @ApiProperty({ description: 'One-time impersonation token from admin portal.' })
  @IsString()
  token!: string;
}

