import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AdminRefreshDto {
  @ApiProperty({ description: 'Refresh token issued during admin login' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}