// src/modules/stats/revenue/dto/revenue-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentStatus } from '@prisma/client';

export class PlatformRevenueQueryDto {
  @ApiPropertyOptional({ description: 'Scope the rollup to a single brand (platform admins only; auto-applied for brand-scoped admins)' })
  @IsOptional()
  @IsUUID()
  brandId?: string;
}

export class RevenueTransactionsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({ description: 'IDR or USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  programId?: string;

  @ApiPropertyOptional({ description: 'Auto-applied/validated for brand-scoped admins' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Invoice createdAt range start (ISO date)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Invoice createdAt range end (ISO date)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Invoice paidAt range start (ISO date)' })
  @IsOptional()
  @IsDateString()
  paidFrom?: string;

  @ApiPropertyOptional({ description: 'Invoice paidAt range end (ISO date)' })
  @IsOptional()
  @IsDateString()
  paidTo?: string;
}
