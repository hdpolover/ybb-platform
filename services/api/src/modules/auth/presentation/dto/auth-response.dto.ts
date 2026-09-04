import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RegisteredProgramDto } from './user-profile.dto';
import { ProgramRegistrationInfo } from '../../application/services/auth-program-linking.util';

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
   * The program-linking outcome of this auth request, when one was resolved.
   * 'closed' — registration closed, so no application was created; the client
   * shows a "registration for <programName> has closed" message. 'created' /
   * 'existing' carry the programId the participant is now actually linked to,
   * which the client uses to pin its active-program selector
   * (ybb_active_program_id) so it doesn't fall back to a stale value from an
   * earlier session on a different program.
   */
  @ApiPropertyOptional()
  programRegistration?: ProgramRegistrationInfo;
}
