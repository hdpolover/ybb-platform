import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SystemFormFieldDto {
  @ApiProperty() id!: string;
  @ApiProperty() key!: string;
  @ApiProperty() label!: string;
  @ApiProperty() category!: string;
  @ApiProperty() type!: string;
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  defaultOptions!: unknown[];
  @ApiPropertyOptional() helpText?: string | null;
  @ApiProperty() isMagic!: boolean;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() order!: number;
}
