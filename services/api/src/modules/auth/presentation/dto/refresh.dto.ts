// src/modules/auth/presentation/dto/refresh.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshDto {
  @ApiProperty({ description: 'Refresh token issued during participant login' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
