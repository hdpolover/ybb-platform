import { IsNotEmpty, IsOptional, IsString, IsUUID, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateGalleryItemDto {
  @IsUUID()
  @IsNotEmpty()
  program_id: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  order?: number;
}
