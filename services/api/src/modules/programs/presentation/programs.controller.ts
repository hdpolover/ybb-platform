import { Controller, Get, Query, Param, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ListProgramsDto } from './dto/list-programs.dto';
import { ProgramListResponseDto } from './dto/program-response.dto';
import { ListProgramsQuery } from '../application/queries/list-programs.query';
import { ListProgramsHandler } from '../application/queries/handlers/list-programs.handler';
import { GetProgramDetailDto } from './dto/get-program-detail.dto';
import { ProgramDetailResponseDto } from './dto/program-detail-response.dto';
import { GetProgramDetailQuery } from '../application/queries/get-program-detail.query';
import { GetProgramDetailHandler } from '../application/queries/handlers/get-program-detail.handler';
import { UpdateProgramDto } from './dto/update-program.dto';
import { UpdateProgramCommand } from '../application/commands/update-program.command';
import { UpdateProgramHandler } from '../application/commands/handlers/update-program.handler';
import { Public } from '../../../shared/decorators/public.decorator';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';

@ApiTags('programs')
@Controller('programs')
export class ProgramsController {
  constructor(
    private readonly listProgramsHandler: ListProgramsHandler,
    private readonly getProgramDetailHandler: GetProgramDetailHandler,
    private readonly updateProgramHandler: UpdateProgramHandler,
  ) {}

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

  @Get(':identifier')
  @Public()
  @ApiOperation({ summary: 'Get program detail by ID or slug' })
  @ApiResponse({ status: 200, type: ProgramDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Program not found' })
  async findOne(
    @Param('identifier') identifier: string,
    @Query('include') include?: string,
    @Query('testimonialsLimit') testimonialsLimit?: number,
    @Query('announcementsLimit') announcementsLimit?: number,
    @Query('resourcesLimit') resourcesLimit?: number,
  ): Promise<ProgramDetailResponseDto> {
    const query = new GetProgramDetailQuery(
      identifier,
      include,
      testimonialsLimit,
      announcementsLimit,
      resourcesLimit,
    );
    return this.getProgramDetailHandler.execute(query);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update program (Admin only)' })
  @ApiResponse({ status: 200, description: 'Program updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Program not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProgramDto,
  ) {
    const command = new UpdateProgramCommand(
      id,
      dto.name,
      dto.description,
      dto.status,
      dto.isVisibleToUsers,
    );
    const program = await this.updateProgramHandler.execute(command);
    
    return {
      message: 'Program updated successfully',
      data: program,
    };
  }
}
