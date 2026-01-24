import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class FirebaseLoginDto {
  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjUyOGR...',
    description: 'The Firebase ID token obtained from the client SDK (e.g. Google Sign-In).'
  })
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'The UUID of the program category (brand scope). Optional if the "x-brand-domain" header is provided.',
    required: false
  })
  @IsUUID()
  @IsOptional()
  programCategoryId?: string;
  
  @ApiProperty({
     example: '123e4567-e89b-12d3-a456-426614174000',
     description: 'To link with a specific program (Waitlist/Registration)',
     required: false
  })
  @IsUUID()
  @IsOptional()
  programId?: string;

  @ApiProperty({
    example: 'ybb-15',
    description: 'To link with a specific program slug',
    required: false
  })
  @IsString()
  @IsOptional()
  programSlug?: string;

  @ApiProperty({
    example: 'K9X2M4P1',
    description: 'Referral code from an ambassador.',
    required: false
  })
  @IsString()
  @IsOptional()
  referralCode?: string;
}
