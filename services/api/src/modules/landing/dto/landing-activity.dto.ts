import { ApiProperty } from '@nestjs/swagger';

export class LandingActivityItemDto {
  @ApiProperty({ example: 'registered', enum: ['registered', 'accepted'], description: 'Kind of activity being announced' })
  type: 'registered' | 'accepted';

  @ApiProperty({ example: 'Yuki T.', description: 'Participant name, masked to first name and last initial' })
  name: string;

  @ApiProperty({ example: 'Japan', description: 'Participant country' })
  country: string;

  @ApiProperty({ example: 'JP', description: 'ISO 3166-1 alpha-2 country code, empty when unknown' })
  countryCode: string;

  @ApiProperty({ example: 'AYIMUN', description: 'Name of the program the activity relates to' })
  programName: string;
}

export class LandingActivityResponseDto {
  @ApiProperty({ example: true, description: 'False when the brand has too few eligible participants to display activity' })
  enabled: boolean;

  @ApiProperty({ type: [LandingActivityItemDto], description: 'Randomly sampled pool of masked activity items' })
  items: LandingActivityItemDto[];
}
