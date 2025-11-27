import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProgramDto {
  @ApiProperty({
    description: 'Program name',
    example: 'Young Entrepreneur Program 2025',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Program description',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Program status',
    example: 'published',
    enum: ['draft', 'published', 'archived'],
    required: false,
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({
    description: 'Whether program is visible to users',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isVisibleToUsers?: boolean;
}
