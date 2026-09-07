import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

// 256 chars comfortably covers real fbp/fbc/ttp/ttclid values (all short
// opaque tokens) while capping what an unauthenticated public endpoint can
// force into the participants.ad_attribution JSON column.
const MAX_CLICK_ID_LENGTH = 256;

/**
 * Ad click identifiers captured client-side at signup, sent once on
 * /auth/register and /auth/firebase-login so they can be replayed on later
 * server-side conversion events for the same person. Only these four keys are
 * accepted — combined with the global ValidationPipe's whitelist:true, any
 * other property on the incoming object is silently stripped rather than
 * stored, since this is unauthenticated public input.
 */
export class AdAttributionDto {
  @ApiPropertyOptional({ description: 'Meta _fbp browser cookie value.' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_CLICK_ID_LENGTH)
  fbp?: string;

  @ApiPropertyOptional({ description: 'Meta _fbc browser cookie / click ID value.' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_CLICK_ID_LENGTH)
  fbc?: string;

  @ApiPropertyOptional({ description: 'TikTok _ttp browser cookie value.' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_CLICK_ID_LENGTH)
  ttp?: string;

  @ApiPropertyOptional({ description: 'TikTok ttclid click ID value.' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_CLICK_ID_LENGTH)
  ttclid?: string;
}
