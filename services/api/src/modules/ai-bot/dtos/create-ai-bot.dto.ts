import { IsString, IsOptional, IsBoolean, IsArray, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAiBotConfigDto {
  @ApiPropertyOptional({ description: 'Existing Brand ID (null for global)', example: 'uuid' })
  @IsUUID()
  @IsOptional()
  brandId?: string;

  @ApiProperty({ description: 'Name of the bot configuration', example: 'General Support Bot' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Type of integration: iframe, script, etc', example: 'iframe' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiProperty({ description: 'The configuration string, URL, or Embed code', example: 'https://bot.example.com/embed/123' })
  @IsString()
  botConfig: string;

  @ApiPropertyOptional({ description: 'Is this configuration active?', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Should this be displayed on the public web?', default: true })
  @IsBoolean()
  @IsOptional()
  displayOnWeb?: boolean;

  @ApiPropertyOptional({ description: 'List of allowed domains', example: ['example.com'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedDomains?: string[];
}
