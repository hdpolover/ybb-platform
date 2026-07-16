import { ApiProperty } from '@nestjs/swagger';
import { PartnershipOpportunityDto } from './partnership-opportunity.dto';
import { SponsorshipTierDto } from './sponsorship-tier.dto';

export class PartnershipResponseDto {
  @ApiProperty({ type: [PartnershipOpportunityDto] })
  opportunities: PartnershipOpportunityDto[];

  @ApiProperty({ type: [SponsorshipTierDto] })
  sponsorshipTiers: SponsorshipTierDto[];
}
