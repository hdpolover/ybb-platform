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
     description: '(Registration only) To automatically link new user with a specific program on first sign-in.',
     required: false
  })
  @IsUUID()
  @IsOptional()
  programId?: string;

  @ApiProperty({
    example: 'ybb-15',
    description: '(Registration only) To automatically link new user with a specific program slug on first sign-in.',
    required: false
  })
  @IsString()
  @IsOptional()
  programSlug?: string;

  @ApiProperty({
    example: 'K9X2M4P1',
    description: '(Registration only) Referral code to credit an ambassador on first sign-in.',
    required: false
  })
  @IsString()
  @IsOptional()
  referralCode?: string;
}
