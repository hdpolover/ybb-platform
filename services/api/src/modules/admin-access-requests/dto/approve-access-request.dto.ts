// services/api/src/modules/admin-access-requests/dto/approve-access-request.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

export class ApproveAccessRequestDto {
  @ApiProperty()
  @IsUUID()
  roleId: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  programIds: string[];
}
