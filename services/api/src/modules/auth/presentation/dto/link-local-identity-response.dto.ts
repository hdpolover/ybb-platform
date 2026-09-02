import { ApiProperty } from '@nestjs/swagger';

export class LinkLocalIdentityResponseDto {
  @ApiProperty({ example: 'local' })
  provider: string;

  @ApiProperty({ example: false })
  isPrimary: boolean;

  @ApiProperty({ example: '2026-09-02T10:00:00.000Z' })
  linkedAt: Date;
}
