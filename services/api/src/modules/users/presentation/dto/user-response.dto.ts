import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type UserRoleEnriched = 'admin' | 'participant' | 'ambassador' | 'none';

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  brandId: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  emailVerified: boolean;

  @ApiPropertyOptional({ enum: ['admin', 'participant', 'ambassador', 'none'] })
  role?: UserRoleEnriched;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
