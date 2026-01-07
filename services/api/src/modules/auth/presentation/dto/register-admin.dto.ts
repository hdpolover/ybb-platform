import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsUUID, MinLength } from 'class-validator';

export class RegisterAdminDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'secret-key-123', description: 'Secret key for admin registration' })
  @IsString()
  @IsNotEmpty()
  secretKey: string;

  @ApiProperty({ 
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Primary Program Category ID (Home Tenant for this account)'
  })
  @IsUUID()
  @IsNotEmpty()
  programCategoryId: string;

  @ApiProperty({ 
    example: 'super_admin', 
    description: 'Role slug: super_admin, program_coordinator, news_writer, etc.' 
  })
  @IsString()
  @IsNotEmpty()
  role: string;
}
