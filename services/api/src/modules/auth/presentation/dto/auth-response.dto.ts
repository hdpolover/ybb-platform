import { ApiProperty } from '@nestjs/swagger';
import { RegisteredProgramDto } from './user-profile.dto';

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty()
  user: {
    id: string;
    email: string;
    brandId: string;
    isActive: boolean;
    isOnboardingCompleted: boolean;
    registeredPrograms?: RegisteredProgramDto[];
  };
}
