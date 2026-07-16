import { IsString, IsDateString, IsOptional } from 'class-validator';

export class CreateLoaBatchDto {
  @IsString() name: string;
  @IsDateString() submissionFrom: string;
  @IsDateString() submissionTo: string;
}

export class UpdateLoaBatchDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsDateString() submissionFrom?: string;
  @IsOptional() @IsDateString() submissionTo?: string;
}

export class LoaBatchResponseDto {
  id: string;
  programId: string;
  name: string;
  submissionFrom: Date;
  submissionTo: Date;
  releasedAt: Date | null;
  eligibleCount: number;
  downloadedCount: number;
  createdAt: Date;
}

export class LoaDownloadResponseDto {
  participantName: string;
  email: string;
  batchName: string | null;
  documentNumber: string;
  firstDownloadedAt: Date | null;
  downloadCount: number;
}
