import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { NormalizeEmail } from '@shared/decorators/normalize-email.decorator';

// This DTO backs a PUBLIC, UNAUTHENTICATED endpoint (partnerships.public.controller.ts),
// so every string field must be bounded to its partnership_enquiries column width and
// REJECTED (not truncated) when over limit — see prisma/schema/content.prisma.
export class SubmitEnquiryDto {
  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  brandId?: string;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  programId?: string;

  // Matches partnership_enquiries.partnership_type VARCHAR(50)
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  partnershipType: string;

  // Matches partnership_enquiries.sub_category VARCHAR(50)
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  subCategory?: string;

  // Matches partnership_enquiries.full_name VARCHAR(255)
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fullName: string;

  // Matches partnership_enquiries.email VARCHAR(255). No @MaxLength needed: validator.js's
  // isEmail() already enforces the RFC 5321 254-char total-length cap, which is tighter
  // than the column, so a format-valid email can never overflow it (verified: a
  // syntactically well-formed 255-char address is itself rejected by @IsEmail).
  @ApiProperty()
  @NormalizeEmail()
  @IsEmail()
  email: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MaxLength(25)
  whatsappNumber?: string;

  // Matches partnership_enquiries.company VARCHAR(255)
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  company?: string;

  // Matches partnership_enquiries.subject VARCHAR(255)
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  subject?: string;

  // description is @db.Text (unbounded) — no length guard needed, can't overflow.
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;
}
