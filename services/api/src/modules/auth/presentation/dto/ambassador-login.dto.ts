import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class AmbassadorLoginDto {
  @ApiProperty({ example: 'ambassador@example.com' })
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
