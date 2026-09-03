import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ApplicationCategory } from '@core/entities/participant-application.entity';

export class SwitchApplicationCategoryRequestDto {
  @ApiProperty({ enum: ApplicationCategory, description: 'The target category to switch to' })
  @IsNotEmpty()
  @IsEnum(ApplicationCategory)
  targetCategory: ApplicationCategory;

  @ApiProperty({
    required: false,
    maxLength: 500,
    description:
      'Admin-only. Reason for switching an application whose registration fee is already paid or processing. Ignored for participants, who can never switch a paid application.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  overrideReason?: string;
}
