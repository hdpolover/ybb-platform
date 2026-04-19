import { IsNotEmpty, IsOptional, IsString, IsUUID, IsNumber, IsUrl } from 'class-validator';
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

  // Year the photo was taken. Shown on admin cards; optional.
  @IsOptional()
  @Transform(({ value }) => (value == null || value === '' ? undefined : parseInt(value, 10)))
  @IsNumber()
  year?: number;

  @IsString()
  @IsOptional()
  type?: string;

  @IsOptional()
  @Transform(({ value }) => (value == null || value === '' ? undefined : parseInt(value, 10)))
  @IsNumber()
  order?: number;

  // When the client already uploaded the image via the presigned flow, it passes
  // the resulting public URL instead of a file blob. Either `file` (multipart)
  // or `image_url` (this field) must be present — the service enforces that.
  @IsOptional()
  @IsUrl()
  image_url?: string;
}
