import { ApiProperty } from '@nestjs/swagger';

export class SponsorshipTierDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  priceDescription?: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  features: string[];
}
