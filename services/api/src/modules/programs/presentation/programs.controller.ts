import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ListProgramsDto } from './dto/list-programs.dto';
import { ProgramListResponseDto } from './dto/program-response.dto';
import { ListProgramsQuery } from '../application/queries/list-programs.query';
import { ListProgramsHandler } from '../application/queries/handlers/list-programs.handler';
import { Public } from '../../../shared/decorators/public.decorator';

@ApiTags('programs')
@Controller('programs')
export class ProgramsController {
  constructor(private readonly listProgramsHandler: ListProgramsHandler) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all programs' })
  @ApiResponse({ status: 200, type: ProgramListResponseDto })
  async findAll(@Query() dto: ListProgramsDto): Promise<ProgramListResponseDto> {
    const query = new ListProgramsQuery(
      dto.programCategoryId,
      dto.year,
      dto.isPublished,
      dto.page,
      dto.limit,
    );
    return this.listProgramsHandler.execute(query);
  }
}
