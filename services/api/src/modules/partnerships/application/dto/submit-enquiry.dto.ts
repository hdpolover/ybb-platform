import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { NormalizeEmail } from '@shared/decorators/normalize-email.decorator';

export class SubmitEnquiryDto {
  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  brandId?: string;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  programId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  partnershipType: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  subCategory?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty()
  @NormalizeEmail()
  @IsEmail()
  email: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  whatsappNumber?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  company?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;
}
