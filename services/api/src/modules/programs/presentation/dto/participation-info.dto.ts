import { IsEnum, IsString, IsOptional, IsBoolean, IsArray, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationCategory } from '@prisma/client';

// benefits/requirements/sections are passthrough only, not a strict nested
// DTO, despite this being an admin-facing field. Evidence says a fixed shape
// would be wrong: every seeded program (seed-programs-iys/jys/cys.ts) writes
// benefits/requirements as plain string arrays, and participation.prisma
// documents `sections` as "Generic sections for flexibility (Hero, Features,
// Steps, etc)" — deliberately polymorphic, with zero producers or consumers
// in this codebase to derive a concrete shape from. Forcing any single
// nested class here would either reject today's real string payloads or
// fabricate an unevidenced object contract. The passthrough still closes the
// corruption vector: without it, class-transformer's implicit conversion
// (main.ts ValidationPipe) would rebuild any future object element as
// `new Array()`, since there is no @Type() to construct against.
//
// Reads from `obj[key]` rather than destructuring `value`: class-transformer
// runs the implicit design:type conversion BEFORE invoking @Transform, so by
// the time a callback receives `value` it is already the corrupted
// `new Array()` result. `obj[key]` is the untouched source property and is
// the only way a @Transform callback can see the real payload here.
const passthroughArray = Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => obj[key]);

export class CreateParticipationInfoDto {
  @ApiProperty({ description: 'Category', enum: ApplicationCategory })
  @IsEnum(ApplicationCategory)
  category: ApplicationCategory;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  heroTitle?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  heroDescription?: string;

  @ApiPropertyOptional({ description: 'List of benefits (JSON)', isArray: true, type: 'object' })
  @IsArray()
  @IsOptional()
  @passthroughArray
  benefits?: Record<string, unknown>[];

  @ApiPropertyOptional({ description: 'List of requirements (JSON)', isArray: true, type: 'object' })
  @IsArray()
  @IsOptional()
  @passthroughArray
  requirements?: Record<string, unknown>[];

  @ApiPropertyOptional({ description: 'Custom sections', isArray: true, type: 'object' })
  @IsArray()
  @IsOptional()
  @passthroughArray
  sections?: Record<string, unknown>[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateParticipationInfoDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  heroTitle?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  heroDescription?: string;

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  @passthroughArray
  benefits?: Record<string, unknown>[];

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  @passthroughArray
  requirements?: Record<string, unknown>[];

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  @passthroughArray
  sections?: Record<string, unknown>[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class ParticipationInfoResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  programId: string;

  @ApiProperty({ enum: ApplicationCategory })
  category: ApplicationCategory;

  @ApiPropertyOptional()
  heroTitle?: string;

  @ApiPropertyOptional()
  heroDescription?: string;

  @ApiPropertyOptional()
  benefits: Record<string, unknown>[] | null;

  @ApiPropertyOptional()
  requirements: Record<string, unknown>[] | null;

  @ApiPropertyOptional()
  sections: Record<string, unknown>[] | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
