// services/api/src/modules/programs/presentation/dto/program-award.dto.ts
import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

// IsOptional() lets null through, which is right for nullable columns (clears
// them) but would hand Prisma a null for NOT NULL ones and 500. Those use this.
const OptionalNotNull = () => ValidateIf((_obj, value) => value !== undefined);

const HTTP_URL = { protocols: ['http', 'https'], require_protocol: true };

// program_awards.order / winner_count are Postgres int4; larger values 500 on write.
const INT32_MAX = 2147483647;

export class CreateProgramAwardDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tier?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @OptionalNotNull()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ minimum: 0, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(INT32_MAX)
  winnerCount?: number | null;

  @ApiPropertyOptional({ example: '#1D4ED8', nullable: true })
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a hex colour like #1D4ED8' })
  color?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @IsUrl(HTTP_URL)
  @MaxLength(500)
  iconUrl?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @IsUrl(HTTP_URL)
  @MaxLength(500)
  badgeUrl?: string | null;

  @ApiPropertyOptional()
  @OptionalNotNull()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @OptionalNotNull()
  @IsInt()
  @Min(-INT32_MAX)
  @Max(INT32_MAX)
  order?: number;
}

export class UpdateProgramAwardDto extends OmitType(CreateProgramAwardDto, ['name'] as const) {
  @ApiPropertyOptional({ maxLength: 255 })
  @OptionalNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;
}
