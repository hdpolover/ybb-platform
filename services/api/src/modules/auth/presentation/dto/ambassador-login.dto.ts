import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { NormalizeEmail } from '@shared/decorators/normalize-email.decorator';

export class AmbassadorLoginDto {
  @ApiProperty({ example: 'ambassador@example.com' })
  @NormalizeEmail()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'K9X2M4P1', description: 'Ambassador referral code (acts as credentials).' })
  @IsString()
  @IsNotEmpty()
  referralCode: string;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  brandId?: string;
}
