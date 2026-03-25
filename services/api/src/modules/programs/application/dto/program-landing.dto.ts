import { IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetProgramLandingDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  newsLimit?: number = 3;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  awardsLimit?: number = 6;
}

export class ProgramLandingResponseDto {
  news: Record<string, unknown>[];
  awards: Record<string, unknown>[];
  scholarship: Record<string, unknown> | null;
  conference: Record<string, unknown> | null;
  program: Record<string, unknown> | null;
}
