import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AdminProgramAssignmentDto {
  @ApiProperty()
  @IsUUID()
  programId: string;
}
