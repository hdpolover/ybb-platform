import { ApiProperty } from '@nestjs/swagger';

export class IdentityDto {
  @ApiProperty({ example: 'local' })
  provider: string;

  @ApiProperty({ example: '2024-03-20T10:00:00Z' })
  lastUsedAt: Date;
}

export class RegisteredProgramDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  programId: string;

  @ApiProperty({ example: 'YBB Ambassador Program' })
  programName: string;

  @ApiProperty({ example: 'ybb-ambassador-2025' })
  programSlug: string;

  @ApiProperty({ example: 2025 })
  year: number;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174001' })
  applicationId: string;

  @ApiProperty({ example: 'draft', description: 'Status of the application' })
  applicationStatus: string;
}

export class UserProfileDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  userId: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  programCategoryId: string;

  @ApiProperty({ type: [IdentityDto] })
  identities: IdentityDto[];

  @ApiProperty({ required: false, nullable: true, example: '123e4567-e89b-12d3-a456-426614174000' })
  participantId?: string;

  @ApiProperty({ type: [RegisteredProgramDto] })
  registeredPrograms: RegisteredProgramDto[];

  @ApiProperty({ example: true, description: 'True if user has effectively completed onboarding' })
  isProfileCompleted: boolean;
}

