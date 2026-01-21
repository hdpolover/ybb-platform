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
  news: any[];   // Update with concrete types later if strictness is needed
  awards: any[];
  scholarship: any;
  conference: any; // Timeline or Schedule
  program: any;    // Basic program info (videoUrl etc)
}
