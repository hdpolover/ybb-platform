// services/api/src/modules/programs/presentation/dto/update-program-contact.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { NormalizeEmail } from '@shared/decorators/normalize-email.decorator';

// Field-for-field mirror of update-brand-details.dto.ts's contact block —
// same validators, now owned by Program instead of Brand. MaxLength guards
// added here (the Brand DTO's own copy is missing them) to match
// Program.contactEmail VARCHAR(255) / contactPhone,contactWhatsapp VARCHAR(50) —
// an unguarded value would otherwise hit Postgres 22001 and surface as an
// opaque 500 (see Global Constraints: VarChar overflow defect class).
export class UpdateProgramContactDto {
  @ApiProperty({ required: false, example: 'contact@example.com' })
  @IsOptional()
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(255)
  contactEmail?: string;

  @ApiProperty({ required: false, example: '+628123456789' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: string;

  @ApiProperty({ required: false, example: '628123456789' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactWhatsapp?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contactAddress?: string;
}
