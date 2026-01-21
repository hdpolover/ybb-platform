import { ApiProperty } from '@nestjs/swagger';

export class PartnershipOpportunityDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ required: false })
  subtitle?: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  features: string[];

  @ApiProperty({ required: false })
  ctaLabel?: string;
}
