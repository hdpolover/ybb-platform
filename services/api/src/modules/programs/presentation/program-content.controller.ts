import { Controller, Get, Param, Put, Post, Delete, Body, UseGuards, Request, UseInterceptors, UploadedFile, Query, BadRequestException } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { Public } from '../../../shared/decorators/public.decorator';
import { CacheInvalidate } from '../../../shared/decorators/cache-invalidate.decorator';
import { PROGRAM_CONTENT_PATTERNS } from '../../../shared/constants/cache-patterns';

import {
  ProgramGalleryResponseDto,
  ProgramTestimonialResponseDto,
  ProgramFaqResponseDto,
  ProgramResourceResponseDto,
} from './dto/program-content.dto';

import {
  ListProgramGalleryQuery,
  ListProgramTestimonialsQuery,
  ListProgramFaqsQuery,
  ListProgramResourcesQuery,
  ListDocumentTemplatesQuery,
} from '../application/queries/list-program-content.queries';

import {
  ListProgramGalleryHandler,
  ListProgramTestimonialsHandler,
  ListProgramFaqsHandler,
  ListProgramResourcesHandler,
  ListDocumentTemplatesHandler,
} from '../application/queries/handlers/list-program-content.handlers';

import {
  CreateProgramGalleryDto, UpdateProgramGalleryDto,
  CreateProgramTestimonialDto, UpdateProgramTestimonialDto,
  CreateProgramFaqDto, UpdateProgramFaqDto,
  CreateProgramResourceDto, UpdateProgramResourceDto,
  CreateDocumentTemplateDto, UpdateDocumentTemplateDto,
} from './dto/create-update-program-content.dto';

import {
  CreateProgramGalleryCommand, UpdateProgramGalleryCommand, DeleteProgramGalleryCommand,
  CreateProgramTestimonialCommand, UpdateProgramTestimonialCommand, DeleteProgramTestimonialCommand,
  CreateProgramFaqCommand, UpdateProgramFaqCommand, DeleteProgramFaqCommand,
  CreateProgramResourceCommand, UpdateProgramResourceCommand, DeleteProgramResourceCommand,
  CreateDocumentTemplateCommand, UpdateDocumentTemplateCommand, DeleteDocumentTemplateCommand,
  GenerateLOACommand,
} from '../application/commands/program-content.commands';

import {
  CreateProgramGalleryHandler, UpdateProgramGalleryHandler, DeleteProgramGalleryHandler,
  CreateProgramTestimonialHandler, UpdateProgramTestimonialHandler, DeleteProgramTestimonialHandler,
  CreateProgramFaqHandler, UpdateProgramFaqHandler, DeleteProgramFaqHandler,
  CreateProgramResourceHandler, UpdateProgramResourceHandler, DeleteProgramResourceHandler,
  CreateDocumentTemplateHandler, UpdateDocumentTemplateHandler, DeleteDocumentTemplateHandler,
  GenerateLOAHandler,
} from '../application/commands/handlers/manage-program-content.handlers';

import { GetLoaStatusQuery, GetLoaStatusHandler } from '../application/queries/get-loa-status.handler';
import { CreateLoaBatchDto, UpdateLoaBatchDto } from '../application/dto/loa-batch.dto';
import {
  CreateLoaBatchCommand,
  UpdateLoaBatchCommand,
  ReleaseLoaBatchCommand,
  UnreleaseLoaBatchCommand,
  DeleteLoaBatchCommand,
} from '../application/commands/loa-batch.commands';
import { GetLoaBatchesQuery, GetLoaDownloadsQuery } from '../application/queries/loa-batch.queries';
import {
  CreateLoaBatchHandler,
  UpdateLoaBatchHandler,
  ReleaseLoaBatchHandler,
  UnreleaseLoaBatchHandler,
  DeleteLoaBatchHandler,
  GetLoaBatchesHandler,
  GetLoaDownloadsHandler,
} from '../application/handlers/loa-batch.handlers';

@ApiTags('Program Content')
@Controller('programs')
export class ProgramContentController {
  constructor(
    private readonly listProgramGalleryHandler: ListProgramGalleryHandler,
    private readonly listProgramTestimonialsHandler: ListProgramTestimonialsHandler,
    private readonly listProgramFaqsHandler: ListProgramFaqsHandler,
    private readonly listProgramResourcesHandler: ListProgramResourcesHandler,
    private readonly createProgramGalleryHandler: CreateProgramGalleryHandler,
    private readonly updateProgramGalleryHandler: UpdateProgramGalleryHandler,
    private readonly deleteProgramGalleryHandler: DeleteProgramGalleryHandler,
    private readonly createProgramTestimonialHandler: CreateProgramTestimonialHandler,
    private readonly updateProgramTestimonialHandler: UpdateProgramTestimonialHandler,
    private readonly deleteProgramTestimonialHandler: DeleteProgramTestimonialHandler,
    private readonly createProgramFaqHandler: CreateProgramFaqHandler,
    private readonly updateProgramFaqHandler: UpdateProgramFaqHandler,
    private readonly deleteProgramFaqHandler: DeleteProgramFaqHandler,
    private readonly createProgramResourceHandler: CreateProgramResourceHandler,
    private readonly updateProgramResourceHandler: UpdateProgramResourceHandler,
    private readonly deleteProgramResourceHandler: DeleteProgramResourceHandler,
    private readonly listDocumentTemplatesHandler: ListDocumentTemplatesHandler,
    private readonly createDocumentTemplateHandler: CreateDocumentTemplateHandler,
    private readonly updateDocumentTemplateHandler: UpdateDocumentTemplateHandler,
    private readonly deleteDocumentTemplateHandler: DeleteDocumentTemplateHandler,
    private readonly generateLOAHandler: GenerateLOAHandler,
    private readonly getLoaStatusHandler: GetLoaStatusHandler,
    private readonly createLoaBatchHandler: CreateLoaBatchHandler,
    private readonly updateLoaBatchHandlerSvc: UpdateLoaBatchHandler,
    private readonly releaseLoaBatchHandlerSvc: ReleaseLoaBatchHandler,
    private readonly unreleaseLoaBatchHandlerSvc: UnreleaseLoaBatchHandler,
    private readonly deleteLoaBatchHandlerSvc: DeleteLoaBatchHandler,
    private readonly getLoaBatchesHandlerSvc: GetLoaBatchesHandler,
    private readonly getLoaDownloadsHandlerSvc: GetLoaDownloadsHandler,
  ) {}

  // --- Gallery Endpoints ---
  @Get(':id/gallery')
  @Public()
  @ApiOperation({ summary: 'Get program gallery' })
  @ApiResponse({ status: 200, type: [ProgramGalleryResponseDto] })
  async getGallery(@Param('id') id: string): Promise<ProgramGalleryResponseDto[]> {
    return this.listProgramGalleryHandler.execute(new ListProgramGalleryQuery(id));
  }

  @Post(':id/gallery')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add gallery item' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async addGallery(
    @Param('id') programId: string, 
    @Body() dto: CreateProgramGalleryDto, 
    @UploadedFile() image: Express.Multer.File,
    @Request() req: ExpressRequest & { user: { id: string } }
  ) {
    return this.createProgramGalleryHandler.execute(new CreateProgramGalleryCommand(dto, req.user.id, image));
  }

  @Put('gallery/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update gallery item' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async updateGallery(
    @Param('itemId') itemId: string, 
    @Body() dto: UpdateProgramGalleryDto, 
    @UploadedFile() image: Express.Multer.File,
    @Request() req: ExpressRequest & { user: { id: string } }
  ) {
    return this.updateProgramGalleryHandler.execute(new UpdateProgramGalleryCommand(itemId, dto, req.user.id, image));
  }

  @Delete('gallery/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete gallery item' })
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async deleteGallery(@Param('itemId') itemId: string, @Request() req: ExpressRequest & { user: { id: string } }) {
    return this.deleteProgramGalleryHandler.execute(new DeleteProgramGalleryCommand(itemId, req.user.id));
  }

  // --- Testimonial Endpoints ---
  @Get(':id/testimonials')
  @Public()
  @ApiOperation({ summary: 'Get program testimonials' })
  @ApiResponse({ status: 200, type: [ProgramTestimonialResponseDto] })
  async getTestimonials(@Param('id') id: string): Promise<ProgramTestimonialResponseDto[]> {
    return this.listProgramTestimonialsHandler.execute(new ListProgramTestimonialsQuery(id));
  }

  @Post(':id/testimonials')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add testimonial' })
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async addTestimonial(@Param('id') programId: string, @Body() dto: CreateProgramTestimonialDto, @Request() req: ExpressRequest & { user: { id: string } }) {
    return this.createProgramTestimonialHandler.execute(new CreateProgramTestimonialCommand(dto, req.user.id));
  }

  @Put('testimonials/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update testimonial' })
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async updateTestimonial(@Param('itemId') itemId: string, @Body() dto: UpdateProgramTestimonialDto, @Request() req: ExpressRequest & { user: { id: string } }) {
    return this.updateProgramTestimonialHandler.execute(new UpdateProgramTestimonialCommand(itemId, dto, req.user.id));
  }

  @Delete('testimonials/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete testimonial' })
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async deleteTestimonial(@Param('itemId') itemId: string, @Request() req: ExpressRequest & { user: { id: string } }) {
    return this.deleteProgramTestimonialHandler.execute(new DeleteProgramTestimonialCommand(itemId, req.user.id));
  }

  // --- FAQ Endpoints ---
  @Get(':id/faqs')
  @Public()
  @ApiOperation({ summary: 'Get program FAQs' })
  @ApiResponse({ status: 200, type: [ProgramFaqResponseDto] })
  async getFaqs(@Param('id') id: string): Promise<ProgramFaqResponseDto[]> {
    return this.listProgramFaqsHandler.execute(new ListProgramFaqsQuery(id));
  }

  @Post(':id/faqs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add FAQ' })
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async addFaq(@Param('id') programId: string, @Body() dto: CreateProgramFaqDto, @Request() req: ExpressRequest & { user: { id: string } }) {
    return this.createProgramFaqHandler.execute(new CreateProgramFaqCommand(dto, req.user.id));
  }

  @Put('faqs/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update FAQ' })
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async updateFaq(@Param('itemId') itemId: string, @Body() dto: UpdateProgramFaqDto, @Request() req: ExpressRequest & { user: { id: string } }) {
    return this.updateProgramFaqHandler.execute(new UpdateProgramFaqCommand(itemId, dto, req.user.id));
  }

  @Delete('faqs/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete FAQ' })
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async deleteFaq(@Param('itemId') itemId: string, @Request() req: ExpressRequest & { user: { id: string } }) {
    return this.deleteProgramFaqHandler.execute(new DeleteProgramFaqCommand(itemId, req.user.id));
  }

  // --- Resource Endpoints ---
  @Get(':id/resources')
  @Public()
  @ApiOperation({ summary: 'Get program resources' })
  @ApiResponse({ status: 200, type: [ProgramResourceResponseDto] })
  async getResources(@Param('id') id: string): Promise<ProgramResourceResponseDto[]> {
    return this.listProgramResourcesHandler.execute(new ListProgramResourcesQuery(id));
  }

  @Post(':id/resources')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add resource' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async addResource(
    @Param('id') programId: string, 
    @Body() dto: CreateProgramResourceDto, 
    @UploadedFile() file: Express.Multer.File,
    @Request() req: ExpressRequest & { user: { id: string } }
  ) {
    return this.createProgramResourceHandler.execute(new CreateProgramResourceCommand(dto, req.user.id, file));
  }

  @Put('resources/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update resource' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async updateResource(
    @Param('itemId') itemId: string, 
    @Body() dto: UpdateProgramResourceDto, 
    @UploadedFile() file: Express.Multer.File,
    @Request() req: ExpressRequest & { user: { id: string } }
  ) {
    return this.updateProgramResourceHandler.execute(new UpdateProgramResourceCommand(itemId, dto, req.user.id, file));
  }

  @Delete('resources/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete resource' })
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async deleteResource(@Param('itemId') itemId: string, @Request() req: ExpressRequest & { user: { id: string } }) {
    return this.deleteProgramResourceHandler.execute(new DeleteProgramResourceCommand(itemId, req.user.id));
  }

  // --- Document Template Endpoints ---
  @Public()
  @Get(':id/document-templates')
  @ApiOperation({ summary: 'List document templates for a program' })
  async listDocumentTemplates(
    @Param('id') programId: string,
    @Query('type') type?: string,
  ) {
    return this.listDocumentTemplatesHandler.execute(new ListDocumentTemplatesQuery(programId, type));
  }

  @Post(':id/document-templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({ summary: 'Create a document template' })
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async createDocumentTemplate(
    @Param('id') programId: string,
    @Body() dto: CreateDocumentTemplateDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Request() req: ExpressRequest & { user: { id: string } },
  ) {
    dto.programId = programId;
    return this.createDocumentTemplateHandler.execute(new CreateDocumentTemplateCommand(dto, req.user.id, file));
  }

  @Put('document-templates/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({ summary: 'Update a document template' })
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async updateDocumentTemplate(
    @Param('itemId') id: string,
    @Body() dto: UpdateDocumentTemplateDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Request() req: ExpressRequest & { user: { id: string } },
  ) {
    return this.updateDocumentTemplateHandler.execute(new UpdateDocumentTemplateCommand(id, dto, req.user.id, file));
  }

  @Delete('document-templates/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a document template' })
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async deleteDocumentTemplate(
    @Param('itemId') id: string,
    @Request() req: ExpressRequest & { user: { id: string } },
  ) {
    return this.deleteDocumentTemplateHandler.execute(new DeleteDocumentTemplateCommand(id, req.user.id));
  }

  @Post(':programId/document-templates/:templateId/generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate LOA PDF(s) for one participant or all eligible participants' })
  async generateLOA(
    @Param('programId') programId: string,
    @Param('templateId') templateId: string,
    @Body() body: {
      participantId?: string;
      participantIds?: string[];
      bulk?: boolean;
      audience?: 'submitted' | 'accepted';
      resend?: boolean;
    },
    @Request() req: ExpressRequest & { user: { id: string } },
  ) {
    if (body.participantIds !== undefined) {
      if (
        !Array.isArray(body.participantIds) ||
        body.participantIds.some((id) => typeof id !== 'string')
      ) {
        throw new BadRequestException('participantIds must be an array of strings');
      }
      if (body.participantIds.length > 1000) {
        throw new BadRequestException('participantIds cannot exceed 1000 entries');
      }
    }
    return this.generateLOAHandler.execute(
      new GenerateLOACommand(
        programId,
        templateId,
        req.user.id,
        body.participantId,
        body.bulk,
        body.audience,
        body.resend,
        body.participantIds,
      ),
    );
  }

  @Get(':programId/document-templates/:templateId/loa-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List per-participant LoA generation and email status' })
  async getLoaStatus(
    @Param('programId') programId: string,
    @Param('templateId') templateId: string,
  ) {
    return this.getLoaStatusHandler.execute(new GetLoaStatusQuery(templateId, programId));
  }

  // --- LOA Release Batch Endpoints ---

  @Get(':programId/loa-batches')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List LOA release batches for a program' })
  async getLoaBatches(@Param('programId') programId: string) {
    return this.getLoaBatchesHandlerSvc.execute(new GetLoaBatchesQuery(programId));
  }

  @Post(':programId/loa-batches')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a LOA release batch' })
  async createLoaBatch(
    @Param('programId') programId: string,
    @Body() dto: CreateLoaBatchDto,
    @Request() req: ExpressRequest & { user: { id: string } },
  ) {
    return this.createLoaBatchHandler.execute(
      new CreateLoaBatchCommand(
        programId,
        dto.name,
        new Date(dto.submissionFrom),
        new Date(dto.submissionTo),
        req.user.id,
      ),
    );
  }

  @Put(':programId/loa-batches/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a LOA release batch' })
  async updateLoaBatch(
    @Param('programId') programId: string,
    @Param('id') batchId: string,
    @Body() dto: UpdateLoaBatchDto,
  ) {
    return this.updateLoaBatchHandlerSvc.execute(
      new UpdateLoaBatchCommand(
        batchId,
        programId,
        dto.name,
        dto.submissionFrom ? new Date(dto.submissionFrom) : undefined,
        dto.submissionTo ? new Date(dto.submissionTo) : undefined,
      ),
    );
  }

  @Post(':programId/loa-batches/:id/release')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Release a LOA batch (make it visible to participants)' })
  async releaseLoaBatch(
    @Param('programId') programId: string,
    @Param('id') batchId: string,
  ) {
    return this.releaseLoaBatchHandlerSvc.execute(new ReleaseLoaBatchCommand(batchId, programId));
  }

  @Post(':programId/loa-batches/:id/unrelease')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unrelease a LOA batch' })
  async unreleaseLoaBatch(
    @Param('programId') programId: string,
    @Param('id') batchId: string,
  ) {
    return this.unreleaseLoaBatchHandlerSvc.execute(new UnreleaseLoaBatchCommand(batchId, programId));
  }

  @Delete(':programId/loa-batches/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a LOA release batch' })
  async deleteLoaBatch(
    @Param('programId') programId: string,
    @Param('id') batchId: string,
  ) {
    return this.deleteLoaBatchHandlerSvc.execute(new DeleteLoaBatchCommand(batchId, programId));
  }

  @Get(':programId/loa-downloads')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List LOA download records for a program' })
  async getLoaDownloads(@Param('programId') programId: string) {
    return this.getLoaDownloadsHandlerSvc.execute(new GetLoaDownloadsQuery(programId));
  }
}
