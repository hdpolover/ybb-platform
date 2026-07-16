import { ApiProperty } from '@nestjs/swagger';

export class ProgressStepDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  stepNumber: number;

  @ApiProperty()
  title: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  date: Date;

  @ApiProperty({ required: false })
  endDate?: Date;

  @ApiProperty({ enum: ['completed', 'in_progress', 'not_yet', 'failed', 'locked', 'expired'] })
  status: string;

  @ApiProperty()
  type: string;
}
