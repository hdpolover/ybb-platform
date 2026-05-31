import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../../shared/decorators/public.decorator';
import { GetProgramLandingQuery } from '../application/queries/get-program-landing.query';
import { GetProgramLandingDto, ProgramLandingResponseDto } from '../application/dto/program-landing.dto';

@ApiTags('Programs')
@Controller('programs')
export class ProgramLandingController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':id/landing')
  @Public()
  @ApiOperation({ summary: 'Get aggregated landing page content (News, Awards, Scholarship, Conference)' })
  @ApiResponse({ status: 200, type: ProgramLandingResponseDto })
  async getLandingPage(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GetProgramLandingDto,
  ): Promise<ProgramLandingResponseDto> {
    return this.queryBus.execute(
      new GetProgramLandingQuery(id, query.newsLimit, query.awardsLimit),
    );
  }
}
