import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';

export class CreateAuthProviderDto {
  @ApiProperty({ example: 'github' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'GitHub' })
  @IsString()
  @IsNotEmpty()
  displayName: string;

  @ApiProperty({ example: 'Login with GitHub', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'client-id-123', required: false })
  @IsString()
  @IsOptional()
  clientId?: string;

  @ApiProperty({ example: 'client-secret-abc', required: false })
  @IsString()
  @IsOptional()
  clientSecret?: string;

  @ApiProperty({ example: 'https://github.com/login/oauth/authorize', required: false })
  @IsString()
  @IsOptional()
  authUrl?: string;

  @ApiProperty({ example: 'https://github.com/login/oauth/access_token', required: false })
  @IsString()
  @IsOptional()
  tokenUrl?: string;

  @ApiProperty({ example: ['read:user', 'user:email'], required: false })
  @IsOptional()
  scopes?: any;

  @ApiProperty({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  @IsOptional()
  isOAuth?: boolean;

  @ApiProperty({ example: 'github' })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiProperty({ example: '#333333' })
  @IsString()
  @IsOptional()
  buttonColor?: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsOptional()
  order?: number;
}
