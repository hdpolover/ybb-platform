// src/modules/auth/presentation/dto/refresh-response.dto.ts

import { ApiProperty } from '@nestjs/swagger';

/**
 * Deliberately NOT AuthResponseDto: login's response also carries
 * registeredPrograms and programRegistration, which come from
 * ensureParticipantExists/ensureProgramApplication - program-linking side
 * effects that only make sense at login time, not on every hourly refresh.
 * A refresh rotates tokens and confirms the user is still active; it does
 * not re-run program linking, so its response is intentionally a named,
 * trimmed subset rather than reusing (or inline-typing) the login shape.
 */
export class RefreshResponseDto {
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
  };
}
