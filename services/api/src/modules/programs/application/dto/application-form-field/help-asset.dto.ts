import {
  ArrayMaxSize,
  IsEnum,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum HelpAssetKind {
  LINK = 'link',
  VIDEO = 'video',
  FILE = 'file',
}

export const HELP_ASSETS_MAX = 5;

export class HelpAssetDto {
  @ApiProperty({ enum: HelpAssetKind })
  @IsEnum(HelpAssetKind)
  kind!: HelpAssetKind;

  @ApiProperty({ description: 'Short label shown on the asset button, e.g. "Example twibbon"' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label!: string;

  @ApiProperty({ description: 'HTTP(S) URL the asset points to' })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url!: string;
}

export class HelpAssetsWrapperDto {
  @ApiProperty({ type: [HelpAssetDto], maxItems: HELP_ASSETS_MAX })
  @ValidateNested({ each: true })
  @Type(() => HelpAssetDto)
  @ArrayMaxSize(HELP_ASSETS_MAX)
  helpAssets!: HelpAssetDto[];
}
