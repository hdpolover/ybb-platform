import { ApiProperty } from '@nestjs/swagger';

export class GlobalProgramImpactDto {
  @ApiProperty({ example: 10019, description: 'Total number of participants across all programs' })
  total_participants: number;

  @ApiProperty({ example: 115, description: 'Total number of countries represented' })
  total_countries: number;

  @ApiProperty({ example: 9281, description: 'Total number of alumni (accepted/completed)' })
  alumni: number;
}

export class ParticipantGeographyItemDto {
  @ApiProperty({ example: 'Indonesia' })
  country: string;

  @ApiProperty({ example: 320 })
  participants: number;

  @ApiProperty({ example: 21.3 })
  percentage: number;
}

export class PaginationMetaDto {
  @ApiProperty({ example: 120 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 6 })
  totalPages: number;
}

export class ParticipantGeographyResponseDto {
  @ApiProperty({ type: [ParticipantGeographyItemDto] })
  items: ParticipantGeographyItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class StatsResponseDto {
  @ApiProperty({ type: GlobalProgramImpactDto, required: false })
  impact?: GlobalProgramImpactDto;

  @ApiProperty({ type: ParticipantGeographyResponseDto, required: false })
  geography?: ParticipantGeographyResponseDto;
}
