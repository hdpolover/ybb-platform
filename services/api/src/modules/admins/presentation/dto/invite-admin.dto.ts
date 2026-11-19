// services/api/src/modules/admins/presentation/dto/invite-admin.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEmail, IsString, IsUUID, Length } from 'class-validator';
import { NormalizeEmail } from '@shared/decorators/normalize-email.decorator';

export class InviteAdminDto {
  @ApiProperty({ minLength: 2, maxLength: 100 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 100)
  fullName: string;

  @ApiProperty()
  @NormalizeEmail()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsUUID()
  roleId: string;

  @ApiProperty({ type: [String], maxItems: 50 })
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  programIds: string[];
}

export class InviteCheckQueryDto {
  @ApiProperty()
  @NormalizeEmail()
  @IsEmail()
  email: string;
}
