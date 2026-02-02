import { Controller, Get, Param, Put, Post, Delete, Body, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';
import { Public } from '../../../shared/decorators/public.decorator';

import {
  ProgramSpeakerResponseDto,
  ProgramTeamResponseDto,
  ProgramPartnerResponseDto,
} from './dto/program-content.dto';

import {
  ListProgramSpeakersQuery,
  ListProgramTeamQuery,
  ListProgramPartnersQuery,
} from '../application/queries/list-program-content.queries';

import {
  ListProgramSpeakersHandler,
  ListProgramTeamHandler,
  ListProgramPartnersHandler,
} from '../application/queries/handlers/list-program-content.handlers';

import {
  CreateProgramSpeakerDto, UpdateProgramSpeakerDto,
  CreateProgramTeamDto, UpdateProgramTeamDto,
  CreateProgramPartnerDto, UpdateProgramPartnerDto,
} from './dto/create-update-program-content.dto';

import {
  CreateProgramSpeakerCommand, UpdateProgramSpeakerCommand, DeleteProgramSpeakerCommand,
  CreateProgramTeamCommand, UpdateProgramTeamCommand, DeleteProgramTeamCommand,
  CreateProgramPartnerCommand, UpdateProgramPartnerCommand, DeleteProgramPartnerCommand,
} from '../application/commands/program-content.commands';

import {
  CreateProgramSpeakerHandler, UpdateProgramSpeakerHandler, DeleteProgramSpeakerHandler,
  CreateProgramTeamHandler, UpdateProgramTeamHandler, DeleteProgramTeamHandler,
  CreateProgramPartnerHandler, UpdateProgramPartnerHandler, DeleteProgramPartnerHandler,
} from '../application/commands/handlers/manage-program-content.handlers';

@ApiTags('Program People')
@Controller('programs')
export class ProgramPeopleController {
  constructor(
    private readonly listProgramSpeakersHandler: ListProgramSpeakersHandler,
    private readonly listProgramTeamHandler: ListProgramTeamHandler,
    private readonly listProgramPartnersHandler: ListProgramPartnersHandler,
    private readonly createProgramSpeakerHandler: CreateProgramSpeakerHandler,
    private readonly updateProgramSpeakerHandler: UpdateProgramSpeakerHandler,
    private readonly deleteProgramSpeakerHandler: DeleteProgramSpeakerHandler,
    private readonly createProgramTeamHandler: CreateProgramTeamHandler,
    private readonly updateProgramTeamHandler: UpdateProgramTeamHandler,
    private readonly deleteProgramTeamHandler: DeleteProgramTeamHandler,
    private readonly createProgramPartnerHandler: CreateProgramPartnerHandler,
    private readonly updateProgramPartnerHandler: UpdateProgramPartnerHandler,
    private readonly deleteProgramPartnerHandler: DeleteProgramPartnerHandler,
  ) {}

  // --- Speaker Endpoints ---
  @Get(':id/speakers')
  @Public()
  @ApiOperation({ summary: 'Get program speakers' })
  @ApiResponse({ status: 200, type: [ProgramSpeakerResponseDto] })
  async getSpeakers(@Param('id') id: string): Promise<ProgramSpeakerResponseDto[]> {
    return this.listProgramSpeakersHandler.execute(new ListProgramSpeakersQuery(id));
  }

  @Post(':id/speakers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add speaker' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo'))
  async addSpeaker(
    @Param('id') programId: string, 
    @Body() dto: CreateProgramSpeakerDto, 
    @UploadedFile() photo: any,
    @Request() req: any
  ) {
    return this.createProgramSpeakerHandler.execute(new CreateProgramSpeakerCommand(dto, req.user.id, photo));
  }

  @Put('speakers/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update speaker' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo'))
  async updateSpeaker(
    @Param('itemId') itemId: string, 
    @Body() dto: UpdateProgramSpeakerDto, 
    @UploadedFile() photo: any,
    @Request() req: any
  ) {
    return this.updateProgramSpeakerHandler.execute(new UpdateProgramSpeakerCommand(itemId, dto, req.user.id, photo));
  }

  @Delete('speakers/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete speaker' })
  async deleteSpeaker(@Param('itemId') itemId: string, @Request() req: any) {
    return this.deleteProgramSpeakerHandler.execute(new DeleteProgramSpeakerCommand(itemId, req.user.id));
  }

  // --- Team Endpoints ---
  @Get(':id/team')
  @Public()
  @ApiOperation({ summary: 'Get program team' })
  @ApiResponse({ status: 200, type: [ProgramTeamResponseDto] })
  async getTeam(@Param('id') id: string): Promise<ProgramTeamResponseDto[]> {
    return this.listProgramTeamHandler.execute(new ListProgramTeamQuery(id));
  }

  @Post(':id/team')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add team member' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo'))
  async addTeam(
    @Param('id') programId: string, 
    @Body() dto: CreateProgramTeamDto, 
    @UploadedFile() photo: any,
    @Request() req: any
  ) {
    return this.createProgramTeamHandler.execute(new CreateProgramTeamCommand(dto, req.user.id, photo));
  }

  @Put('team/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update team member' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo'))
  async updateTeam(
    @Param('itemId') itemId: string, 
    @Body() dto: UpdateProgramTeamDto, 
    @UploadedFile() photo: any,
    @Request() req: any
  ) {
    return this.updateProgramTeamHandler.execute(new UpdateProgramTeamCommand(itemId, dto, req.user.id, photo));
  }

  @Delete('team/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete team member' })
  async deleteTeam(@Param('itemId') itemId: string, @Request() req: any) {
    return this.deleteProgramTeamHandler.execute(new DeleteProgramTeamCommand(itemId, req.user.id));
  }

  // --- Partner Endpoints ---
  @Get(':id/partners')
  @Public()
  @ApiOperation({ summary: 'Get program partners' })
  @ApiResponse({ status: 200, type: [ProgramPartnerResponseDto] })
  async getPartners(@Param('id') id: string): Promise<ProgramPartnerResponseDto[]> {
    return this.listProgramPartnersHandler.execute(new ListProgramPartnersQuery(id));
  }

  @Post(':id/partners')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add partner' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('logo'))
  async addPartner(
    @Param('id') programId: string, 
    @Body() dto: CreateProgramPartnerDto, 
    @UploadedFile() logo: any,
    @Request() req: any
  ) {
    return this.createProgramPartnerHandler.execute(new CreateProgramPartnerCommand(dto, req.user.id, logo));
  }

  @Put('partners/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update partner' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('logo'))
  async updatePartner(
    @Param('itemId') itemId: string, 
    @Body() dto: UpdateProgramPartnerDto, 
    @UploadedFile() logo: any,
    @Request() req: any
  ) {
    return this.updateProgramPartnerHandler.execute(new UpdateProgramPartnerCommand(itemId, dto, req.user.id, logo));
  }

  @Delete('partners/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete partner' })
  async deletePartner(@Param('itemId') itemId: string, @Request() req: any) {
    return this.deleteProgramPartnerHandler.execute(new DeleteProgramPartnerCommand(itemId, req.user.id));
  }
}
