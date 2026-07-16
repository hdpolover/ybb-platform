import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

  /**
   * Present only when the program targeted by this auth request had its
   * registration closed, so no application was created. Auth still succeeds
   * (login/register never fail on a closed program) — the client uses this
   * to show a "registration for <programName> has closed" message instead of
   * silently doing nothing.
   */
  @ApiPropertyOptional()
  programRegistration?: {
    status: 'closed';
    programId: string;
    programName: string;
  };
}
