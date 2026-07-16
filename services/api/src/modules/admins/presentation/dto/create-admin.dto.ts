
import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { NormalizeEmail } from '@shared/decorators/normalize-email.decorator';

export class CreateAdminDto {
  @ApiProperty()
  @NormalizeEmail()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @ApiProperty({ required: false, isArray: true })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  brandIds?: string[];

  @ApiProperty({ required: false, isArray: true })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  programIds?: string[];
}
