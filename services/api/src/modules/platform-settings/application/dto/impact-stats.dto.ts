// services/api/src/modules/platform-settings/application/dto/impact-stats.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

// Values are display strings today ("1700+", "15+") not numbers — matches
// the shape already live in Brand.metadata.impact_stats across China/MEYS/Korea.
export class ImpactStatsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() totalAlumni?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() editionsHeld?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() totalCountries?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() totalParticipants?: string;
}

export interface ImpactStats {
  totalAlumni: string | null;
  editionsHeld: string | null;
  totalCountries: string | null;
  totalParticipants: string | null;
}
