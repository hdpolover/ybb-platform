import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ApplicationCategory } from '@core/entities/participant-application.entity';

export class SwitchApplicationCategoryRequestDto {
  @ApiProperty({ enum: ApplicationCategory, description: 'The target category to switch to' })
  @IsNotEmpty()
  @IsEnum(ApplicationCategory)
  targetCategory: ApplicationCategory;
}
