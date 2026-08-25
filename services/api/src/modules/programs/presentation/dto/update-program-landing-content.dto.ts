// services/api/src/modules/programs/presentation/dto/update-program-landing-content.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

// Loose object, like UpdateBrandMetadataDto — the 7-key allow-list is
// enforced in the handler (program-landing-content.constants.ts), not here.
// Unknown top-level keys are REJECTED (BadRequestException), not silently
// stripped — this project's recurring defect class is a value the admin
// entered vanishing with no signal (see task-4-6-report.md).
export class UpdateProgramLandingContentDto {
  @ApiProperty({
    description: 'Partial landingContent object. Top-level keys are merged into existing content. Legal keys: benefits, features, promo_cta, moments_shorts, further_information, payment_info, participant_demographics.',
    example: { benefits: { eyebrow: 'Program Benefits', title: 'Built for Students', groups: [] } },
  })
  @IsObject()
  patch!: Record<string, unknown>;
}
