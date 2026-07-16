import { IsNumber, IsOptional, IsString, IsUrl, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Partial update DTO. All fields are optional — the handler only writes
 * what's provided. program_id is intentionally absent: gallery items don't
 * move between programs, deletion + recreation is clearer if that's ever needed.
 */
export class UpdateGalleryItemDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  @Transform(({ value }) => (value == null || value === '' ? undefined : parseInt(value, 10)))
  @IsNumber()
  year?: number;

  @IsOptional()
  @IsUrl()
  image_url?: string;

  @IsOptional()
  @Transform(({ value }) => (value == null || value === '' ? undefined : parseInt(value, 10)))
  @IsNumber()
  order?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
