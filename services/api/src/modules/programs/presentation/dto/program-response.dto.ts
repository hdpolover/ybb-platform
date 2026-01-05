import { ApiProperty } from '@nestjs/swagger';

export class ProgramResponseDto {
  @ApiProperty({ example: '4202cef4-9e6d-4772-bea7-e01a719138fe' })
  id: string;

  @ApiProperty({ example: '005b17ba-b481-45f5-a945-7723248b6415' })
  programCategoryId: string;

  @ApiProperty({ example: 'Young Entrepreneur Program 2025' })
  name: string;

  @ApiProperty({ example: 'young-entrepreneur-program-2025' })
  slug: string;

  @ApiProperty({ example: 'A comprehensive program for young entrepreneurs' })
  description: string | null;

  @ApiProperty({ example: 2025 })
  year: number;

  @ApiProperty({ example: '2025-03-01T00:00:00.000Z' })
  startDate: Date;

  @ApiProperty({ example: '2025-12-31T00:00:00.000Z' })
  endDate: Date;

  @ApiProperty({ example: '2025-02-15T23:59:59.000Z' })
  applicationDeadline: Date;

  @ApiProperty({ example: 'Jakarta, Indonesia' })
  location: string | null;

  @ApiProperty({ example: 100 })
  capacity: number | null;

  @ApiProperty({ example: true })
  isPublished: boolean;

  @ApiProperty({ example: '2025-11-25T16:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-11-25T16:00:00.000Z' })
  updatedAt: Date;
}

export class ProgramListResponseDto {
  @ApiProperty({ type: [ProgramResponseDto] })
  data: ProgramResponseDto[];

  @ApiProperty({ example: 1 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 1 })
  totalPages: number;
}
