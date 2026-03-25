import { Controller, Get, Param, Put, Post, Delete, Body, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';
import { Public } from '../../../shared/decorators/public.decorator';

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
} from '../application/queries/list-program-content.queries';

import {
  ListProgramGalleryHandler,
  ListProgramTestimonialsHandler,
  ListProgramFaqsHandler,
  ListProgramResourcesHandler,
} from '../application/queries/handlers/list-program-content.handlers';

import {
  CreateProgramGalleryDto, UpdateProgramGalleryDto,
  CreateProgramTestimonialDto, UpdateProgramTestimonialDto,
  CreateProgramFaqDto, UpdateProgramFaqDto,
  CreateProgramResourceDto, UpdateProgramResourceDto,
} from './dto/create-update-program-content.dto';

import {
  CreateProgramGalleryCommand, UpdateProgramGalleryCommand, DeleteProgramGalleryCommand,
  CreateProgramTestimonialCommand, UpdateProgramTestimonialCommand, DeleteProgramTestimonialCommand,
  CreateProgramFaqCommand, UpdateProgramFaqCommand, DeleteProgramFaqCommand,
  CreateProgramResourceCommand, UpdateProgramResourceCommand, DeleteProgramResourceCommand,
} from '../application/commands/program-content.commands';

import {
  CreateProgramGalleryHandler, UpdateProgramGalleryHandler, DeleteProgramGalleryHandler,
  CreateProgramTestimonialHandler, UpdateProgramTestimonialHandler, DeleteProgramTestimonialHandler,
  CreateProgramFaqHandler, UpdateProgramFaqHandler, DeleteProgramFaqHandler,
  CreateProgramResourceHandler, UpdateProgramResourceHandler, DeleteProgramResourceHandler,
} from '../application/commands/handlers/manage-program-content.handlers';

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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add gallery item' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  async addGallery(
    @Param('id') programId: string, 
    @Body() dto: CreateProgramGalleryDto, 
    @UploadedFile() image: Express.Multer.File,
    @Request() req: ExpressRequest & { user: { id: string } }
  ) {
    return this.createProgramGalleryHandler.execute(new CreateProgramGalleryCommand(dto, req.user.id, image));
  }

  @Put('gallery/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update gallery item' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  async updateGallery(
    @Param('itemId') itemId: string, 
    @Body() dto: UpdateProgramGalleryDto, 
    @UploadedFile() image: Express.Multer.File,
    @Request() req: ExpressRequest & { user: { id: string } }
  ) {
    return this.updateProgramGalleryHandler.execute(new UpdateProgramGalleryCommand(itemId, dto, req.user.id, image));
  }

  @Delete('gallery/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete gallery item' })
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add testimonial' })
  async addTestimonial(@Param('id') programId: string, @Body() dto: CreateProgramTestimonialDto, @Request() req: ExpressRequest & { user: { id: string } }) {
    return this.createProgramTestimonialHandler.execute(new CreateProgramTestimonialCommand(dto, req.user.id));
  }

  @Put('testimonials/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update testimonial' })
  async updateTestimonial(@Param('itemId') itemId: string, @Body() dto: UpdateProgramTestimonialDto, @Request() req: ExpressRequest & { user: { id: string } }) {
    return this.updateProgramTestimonialHandler.execute(new UpdateProgramTestimonialCommand(itemId, dto, req.user.id));
  }

  @Delete('testimonials/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete testimonial' })
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add FAQ' })
  async addFaq(@Param('id') programId: string, @Body() dto: CreateProgramFaqDto, @Request() req: ExpressRequest & { user: { id: string } }) {
    return this.createProgramFaqHandler.execute(new CreateProgramFaqCommand(dto, req.user.id));
  }

  @Put('faqs/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update FAQ' })
  async updateFaq(@Param('itemId') itemId: string, @Body() dto: UpdateProgramFaqDto, @Request() req: ExpressRequest & { user: { id: string } }) {
    return this.updateProgramFaqHandler.execute(new UpdateProgramFaqCommand(itemId, dto, req.user.id));
  }

  @Delete('faqs/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete FAQ' })
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add resource' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async addResource(
    @Param('id') programId: string, 
    @Body() dto: CreateProgramResourceDto, 
    @UploadedFile() file: Express.Multer.File,
    @Request() req: ExpressRequest & { user: { id: string } }
  ) {
    return this.createProgramResourceHandler.execute(new CreateProgramResourceCommand(dto, req.user.id, file));
  }

  @Put('resources/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update resource' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async updateResource(
    @Param('itemId') itemId: string, 
    @Body() dto: UpdateProgramResourceDto, 
    @UploadedFile() file: Express.Multer.File,
    @Request() req: ExpressRequest & { user: { id: string } }
  ) {
    return this.updateProgramResourceHandler.execute(new UpdateProgramResourceCommand(itemId, dto, req.user.id, file));
  }

  @Delete('resources/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete resource' })
  async deleteResource(@Param('itemId') itemId: string, @Request() req: ExpressRequest & { user: { id: string } }) {
    return this.deleteProgramResourceHandler.execute(new DeleteProgramResourceCommand(itemId, req.user.id));
  }
}
