import { Controller, Get, Param, Put, Post, Delete, Body, UseGuards, Request, Response, StreamableFile, UseInterceptors, UploadedFile, Query } from '@nestjs/common';
import { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { Public } from '../../../shared/decorators/public.decorator';
import { CacheInvalidate } from '../../../shared/decorators/cache-invalidate.decorator';
import { PROGRAM_CONTENT_PATTERNS, PROGRAM_PUBLIC_CONTENT_PATTERNS } from '../../../shared/constants/cache-patterns';

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
  CreateDocumentTemplateDto, UpdateDocumentTemplateDto, PreviewDocumentTemplateDto,
} from './dto/create-update-program-content.dto';

import {
  CreateProgramGalleryCommand, UpdateProgramGalleryCommand, DeleteProgramGalleryCommand,
  CreateProgramTestimonialCommand, UpdateProgramTestimonialCommand, DeleteProgramTestimonialCommand,
  CreateProgramFaqCommand, UpdateProgramFaqCommand, DeleteProgramFaqCommand,
  CreateProgramResourceCommand, UpdateProgramResourceCommand, DeleteProgramResourceCommand,
  CreateDocumentTemplateCommand, UpdateDocumentTemplateCommand, DeleteDocumentTemplateCommand,
} from '../application/commands/program-content.commands';

import {
  CreateProgramGalleryHandler, UpdateProgramGalleryHandler, DeleteProgramGalleryHandler,
  CreateProgramTestimonialHandler, UpdateProgramTestimonialHandler, DeleteProgramTestimonialHandler,
  CreateProgramFaqHandler, UpdateProgramFaqHandler, DeleteProgramFaqHandler,
  CreateProgramResourceHandler, UpdateProgramResourceHandler, DeleteProgramResourceHandler,
  CreateDocumentTemplateHandler, UpdateDocumentTemplateHandler, DeleteDocumentTemplateHandler,
} from '../application/commands/handlers/manage-program-content.handlers';

import { CreateLoaBatchDto, UpdateLoaBatchDto } from '../application/dto/loa-batch.dto';
import {
  CreateLoaBatchCommand,
  UpdateLoaBatchCommand,
  ReleaseLoaBatchCommand,
  UnreleaseLoaBatchCommand,
  DeleteLoaBatchCommand,
} from '../application/commands/loa-batch.commands';
import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';
import {
  GetLoaBatchesQuery,
  GetLoaDownloadsQuery,
  GetLoaBatchRecipientSendsQuery,
} from '../application/queries/loa-batch.queries';
import {
  CreateLoaBatchHandler,
  UpdateLoaBatchHandler,
  ReleaseLoaBatchHandler,
  UnreleaseLoaBatchHandler,
  DeleteLoaBatchHandler,
  GetLoaBatchesHandler,
  GetLoaDownloadsHandler,
  GetLoaBatchRecipientSendsHandler,
} from '../application/handlers/loa-batch.handlers';
import { PreviewLoaTemplateQuery, PreviewLoaTemplateHandler } from '../application/handlers/loa-preview.handler';
import { multerLimits } from '@common/constants';

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
    private readonly createLoaBatchHandler: CreateLoaBatchHandler,
    private readonly updateLoaBatchHandlerSvc: UpdateLoaBatchHandler,
    private readonly releaseLoaBatchHandlerSvc: ReleaseLoaBatchHandler,
    private readonly unreleaseLoaBatchHandlerSvc: UnreleaseLoaBatchHandler,
    private readonly deleteLoaBatchHandlerSvc: DeleteLoaBatchHandler,
    private readonly getLoaBatchesHandlerSvc: GetLoaBatchesHandler,
    private readonly getLoaDownloadsHandlerSvc: GetLoaDownloadsHandler,
    private readonly getLoaBatchRecipientSendsHandlerSvc: GetLoaBatchRecipientSendsHandler,
    private readonly previewLoaTemplateHandler: PreviewLoaTemplateHandler,
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
  @UseInterceptors(FileInterceptor('image', multerLimits()))
  // Gallery, testimonials and FAQs are landing-page-only content: no portal read
  // selects them, so the per-user portal:* keys are left alone. Resources and
  // document templates below DO reach the portal and keep the broad patterns.
  @CacheInvalidate(PROGRAM_PUBLIC_CONTENT_PATTERNS)
  async addGallery(
    @Param('id') programId: string, 
    @Body() dto: CreateProgramGalleryDto, 
    @UploadedFile() image: Express.Multer.File,
    @Request() req: ExpressRequest & { user: { id: string } },
    @CurrentUser() actor: CurrentUserData,
  ) {
    // NOTE: @ScopedBy('program', 'id') is deliberately NOT used here even though
    // the route carries a program id. The handler acts on dto.programId, not the
    // route param, and the two are separate inputs - a caller can diverge them.
    // A guard on the route param would authorise one program while the row
    // landed on another, and the audit trail would record a clean check. The
    // handler asserts on the id it actually writes instead.
    //
    // Removing programId from the DTO so the route param became the only source
    // was considered and rejected: ValidationPipe runs whitelist +
    // forbidNonWhitelisted, and the admin dashboard sends programId in the body
    // as well as the URL, so dropping it from the DTO would 400 every live
    // create until the frontend shipped.
    return this.createProgramGalleryHandler.execute(new CreateProgramGalleryCommand(dto, req.user.id, actor, image));
  }

  @Put('gallery/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update gallery item' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image', multerLimits()))
  @CacheInvalidate(PROGRAM_PUBLIC_CONTENT_PATTERNS)
  async updateGallery(
    @Param('itemId') itemId: string, 
    @Body() dto: UpdateProgramGalleryDto, 
    @UploadedFile() image: Express.Multer.File,
    @Request() req: ExpressRequest & { user: { id: string } },
    @CurrentUser() actor: CurrentUserData,
  ) {
    return this.updateProgramGalleryHandler.execute(new UpdateProgramGalleryCommand(itemId, dto, req.user.id, actor, image));
  }

  @Delete('gallery/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete gallery item' })
  @CacheInvalidate(PROGRAM_PUBLIC_CONTENT_PATTERNS)
  async deleteGallery(
    @Param('itemId') itemId: string,
    @Request() req: ExpressRequest & { user: { id: string } },
    @CurrentUser() actor: CurrentUserData,
  ) {
    return this.deleteProgramGalleryHandler.execute(new DeleteProgramGalleryCommand(itemId, req.user.id, actor));
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
  @CacheInvalidate(PROGRAM_PUBLIC_CONTENT_PATTERNS)
  async addTestimonial(
    @Param('id') programId: string,
    @Body() dto: CreateProgramTestimonialDto,
    @Request() req: ExpressRequest & { user: { id: string } },
    @CurrentUser() actor: CurrentUserData,
  ) {
    // Same reasoning as addGallery: the handler acts on dto.programId/dto.brandId,
    // not this route param, so the scope check lives in the handler.
    return this.createProgramTestimonialHandler.execute(new CreateProgramTestimonialCommand(dto, req.user.id, actor));
  }

  @Put('testimonials/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update testimonial' })
  @CacheInvalidate(PROGRAM_PUBLIC_CONTENT_PATTERNS)
  async updateTestimonial(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateProgramTestimonialDto,
    @Request() req: ExpressRequest & { user: { id: string } },
    @CurrentUser() actor: CurrentUserData,
  ) {
    return this.updateProgramTestimonialHandler.execute(new UpdateProgramTestimonialCommand(itemId, dto, req.user.id, actor));
  }

  @Delete('testimonials/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete testimonial' })
  @CacheInvalidate(PROGRAM_PUBLIC_CONTENT_PATTERNS)
  async deleteTestimonial(
    @Param('itemId') itemId: string,
    @Request() req: ExpressRequest & { user: { id: string } },
    @CurrentUser() actor: CurrentUserData,
  ) {
    return this.deleteProgramTestimonialHandler.execute(new DeleteProgramTestimonialCommand(itemId, req.user.id, actor));
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
  @CacheInvalidate(PROGRAM_PUBLIC_CONTENT_PATTERNS)
  async addFaq(
    @Param('id') programId: string,
    @Body() dto: CreateProgramFaqDto,
    @Request() req: ExpressRequest & { user: { id: string } },
    @CurrentUser() actor: CurrentUserData,
  ) {
    // dto.programId, not this route param - see addGallery above for why.
    return this.createProgramFaqHandler.execute(new CreateProgramFaqCommand(dto, req.user.id, actor));
  }

  @Put('faqs/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update FAQ' })
  @CacheInvalidate(PROGRAM_PUBLIC_CONTENT_PATTERNS)
  async updateFaq(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateProgramFaqDto,
    @Request() req: ExpressRequest & { user: { id: string } },
    @CurrentUser() actor: CurrentUserData,
  ) {
    return this.updateProgramFaqHandler.execute(new UpdateProgramFaqCommand(itemId, dto, req.user.id, actor));
  }

  @Delete('faqs/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete FAQ' })
  @CacheInvalidate(PROGRAM_PUBLIC_CONTENT_PATTERNS)
  async deleteFaq(
    @Param('itemId') itemId: string,
    @Request() req: ExpressRequest & { user: { id: string } },
    @CurrentUser() actor: CurrentUserData,
  ) {
    return this.deleteProgramFaqHandler.execute(new DeleteProgramFaqCommand(itemId, req.user.id, actor));
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
  @UseInterceptors(FileInterceptor('file', multerLimits()))
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async addResource(
    @Param('id') programId: string,
    @Body() dto: CreateProgramResourceDto,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: ExpressRequest & { user: { id: string } },
    @CurrentUser() actor: CurrentUserData,
  ) {
    // dto.programId, not this route param - see addGallery above for why.
    return this.createProgramResourceHandler.execute(new CreateProgramResourceCommand(dto, req.user.id, actor, file));
  }

  @Put('resources/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update resource' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', multerLimits()))
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async updateResource(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateProgramResourceDto,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: ExpressRequest & { user: { id: string } },
    @CurrentUser() actor: CurrentUserData,
  ) {
    return this.updateProgramResourceHandler.execute(new UpdateProgramResourceCommand(itemId, dto, req.user.id, actor, file));
  }

  @Delete('resources/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete resource' })
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async deleteResource(
    @Param('itemId') itemId: string,
    @Request() req: ExpressRequest & { user: { id: string } },
    @CurrentUser() actor: CurrentUserData,
  ) {
    return this.deleteProgramResourceHandler.execute(new DeleteProgramResourceCommand(itemId, req.user.id, actor));
  }

  // --- Document Template Endpoints ---
  @Get(':id/document-templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List document templates for a program' })
  async listDocumentTemplates(
    @Param('id') programId: string,
    @CurrentUser() actor: CurrentUserData,
    @Query('type') type?: string,
  ) {
    // Admin-only, previously unscoped: any admin could list any programme's
    // document templates by id.
    return this.listDocumentTemplatesHandler.execute(new ListDocumentTemplatesQuery(programId, actor, type));
  }

  @Post(':id/document-templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file', multerLimits()))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({ summary: 'Create a document template' })
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async createDocumentTemplate(
    @Param('id') programId: string,
    @Body() dto: CreateDocumentTemplateDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Request() req: ExpressRequest & { user: { id: string } },
    @CurrentUser() actor: CurrentUserData,
  ) {
    // dto.programId is stamped from the route param right here, so the two
    // never diverge for this route - but the handler still asserts on
    // dto.programId, matching the pattern everywhere else in this controller.
    dto.programId = programId;
    return this.createDocumentTemplateHandler.execute(new CreateDocumentTemplateCommand(dto, req.user.id, actor, file));
  }

  @Post(':id/document-templates/preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Render an Invitation Letter (draft or saved) through the real PDF generator, with real participant data when available' })
  @ApiResponse({ status: 200, description: 'PDF binary' })
  @ApiResponse({ status: 404, description: 'applicationId not found for this program' })
  @ApiResponse({ status: 409, description: 'source=saved requested but no active template is published' })
  async previewDocumentTemplate(
    @Param('id') programId: string,
    @Body() dto: PreviewDocumentTemplateDto,
    @Response({ passthrough: true }) res: ExpressResponse,
    @CurrentUser() actor: CurrentUserData,
  ) {
    const result = await this.previewLoaTemplateHandler.execute(
      new PreviewLoaTemplateQuery(
        programId,
        dto.htmlContent,
        dto.layoutConfig ?? {},
        dto.placeholders ?? [],
        actor,
        dto.applicationId,
        dto.source ?? 'draft',
      ),
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="preview.pdf"',
      // URI-encoded since participant names may contain non-ASCII characters.
      // Decoded client-side in admin-dashboard's previewDocumentTemplate().
      'X-Preview-Participant-Name': encodeURIComponent(result.participantName),
      'X-Preview-Is-Sample': String(result.isSample),
      // Which application was actually resolved (empty when isSample) - lets
      // the caller pin an auto-picked result instead of silently re-picking
      // (possibly a different application) on the next request.
      'X-Preview-Application-Id': result.applicationId ?? '',
    });
    return new StreamableFile(result.buffer);
  }

  @Put('document-templates/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file', multerLimits()))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({ summary: 'Update a document template' })
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async updateDocumentTemplate(
    @Param('itemId') id: string,
    @Body() dto: UpdateDocumentTemplateDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Request() req: ExpressRequest & { user: { id: string } },
    @CurrentUser() actor: CurrentUserData,
  ) {
    return this.updateDocumentTemplateHandler.execute(new UpdateDocumentTemplateCommand(id, dto, req.user.id, actor, file));
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
    @CurrentUser() actor: CurrentUserData,
  ) {
    return this.deleteDocumentTemplateHandler.execute(new DeleteDocumentTemplateCommand(id, req.user.id, actor));
  }

  // --- LOA Release Batch Endpoints ---
  //
  // :programId here may be a program SLUG, not a UUID - the admin dashboard's
  // useResolvedProgramId falls back to the raw route value whenever the
  // program is not (yet, or ever, for this admin) in accessiblePrograms, and
  // that is the normal steady state for a program-scoped admin on their own
  // page, not just a first-load race. A controller-level @ScopedBy on this
  // param would 404 that admin - and a super admin too, since
  // assertProgramAccess looks the row up by id before its platform-scope
  // short-circuit. So there is deliberately no guard decorator here: each
  // handler in loa-batch.handlers.ts resolves the slug to an id once
  // (resolveProgramId) and asserts on the resolved id itself.

  @Get(':programId/loa-batches')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List LOA release batches for a program' })
  async getLoaBatches(
    @Param('programId') programId: string,
    @CurrentUser() actor: CurrentUserData,
  ) {
    return this.getLoaBatchesHandlerSvc.execute(new GetLoaBatchesQuery(programId, actor));
  }

  @Get(':programId/loa-batches/:id/recipient-sends')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Per-recipient delivery status for one released LOA batch, plus the count of applicants covered by no released batch',
  })
  async getLoaBatchRecipientSends(
    @Param('programId') programId: string,
    @Param('id') batchId: string,
    @CurrentUser() actor: CurrentUserData,
  ) {
    return this.getLoaBatchRecipientSendsHandlerSvc.execute(
      new GetLoaBatchRecipientSendsQuery(programId, batchId, actor),
    );
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
    @CurrentUser() actor: CurrentUserData,
  ) {
    return this.createLoaBatchHandler.execute(
      new CreateLoaBatchCommand(
        programId,
        dto.name,
        new Date(dto.paymentFrom),
        new Date(dto.paymentTo),
        req.user.id,
        actor,
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
    @CurrentUser() actor: CurrentUserData,
  ) {
    return this.updateLoaBatchHandlerSvc.execute(
      new UpdateLoaBatchCommand(
        batchId,
        programId,
        actor,
        dto.name,
        dto.paymentFrom ? new Date(dto.paymentFrom) : undefined,
        dto.paymentTo ? new Date(dto.paymentTo) : undefined,
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
    @CurrentUser() actor: CurrentUserData,
  ) {
    return this.releaseLoaBatchHandlerSvc.execute(new ReleaseLoaBatchCommand(batchId, programId, actor));
  }

  @Post(':programId/loa-batches/:id/unrelease')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unrelease a LOA batch' })
  async unreleaseLoaBatch(
    @Param('programId') programId: string,
    @Param('id') batchId: string,
    @CurrentUser() actor: CurrentUserData,
  ) {
    return this.unreleaseLoaBatchHandlerSvc.execute(new UnreleaseLoaBatchCommand(batchId, programId, actor));
  }

  @Delete(':programId/loa-batches/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a LOA release batch' })
  async deleteLoaBatch(
    @Param('programId') programId: string,
    @Param('id') batchId: string,
    @CurrentUser() actor: CurrentUserData,
  ) {
    return this.deleteLoaBatchHandlerSvc.execute(new DeleteLoaBatchCommand(batchId, programId, actor));
  }

  @Get(':programId/loa-downloads')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List LOA download records for a program' })
  async getLoaDownloads(
    @Param('programId') programId: string,
    @CurrentUser() actor: CurrentUserData,
  ) {
    return this.getLoaDownloadsHandlerSvc.execute(new GetLoaDownloadsQuery(programId, actor));
  }
}
