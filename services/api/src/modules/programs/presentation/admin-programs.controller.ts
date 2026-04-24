import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';

interface AdminRequest extends ExpressRequest {
  user: { id: string; adminId?: string };
}

/**
 * Admin-only program lookup.
 * Uses `deletedAt: undefined` to bypass the global soft-delete middleware so
 * admins can view programs that have been soft-deleted (stale session data,
 * archived programs, etc.).
 */
@ApiTags('admin/programs')
@Controller('admin/programs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdminProgramsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get program by ID for admin (bypasses soft-delete filter)' })
  @ApiResponse({ status: 200, description: 'Program found' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'Program not found' })
  async findOneForAdmin(
    @Param('id') id: string,
    @Request() req: AdminRequest,
  ) {
    if (!req.user.adminId) {
      throw new ForbiddenException('Admin access required');
    }

    // Passing `deletedAt: undefined` explicitly causes the soft-delete
    // middleware to be bypassed: the middleware does
    //   `args.where = { deletedAt: null, ...args.where }`
    // so our explicit `deletedAt: undefined` overrides the injected `null`.
    const program = await this.prisma.program.findFirst({
      where: {
        id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        deletedAt: undefined as any,
      },
      include: {
        brand: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!program) {
      throw new NotFoundException(`Program with ID "${id}" not found`);
    }

    return {
        id: program.id,
        name: program.name,
        slug: program.slug,
        description: program.description ?? null,
        shortDescription: program.shortDescription ?? null,
        startDate: program.startDate ?? null,
        endDate: program.endDate ?? null,
        applicationDeadline: program.applicationDeadline ?? null,
        registrationOpenDate: program.registrationOpenDate ?? null,
        registrationCloseDate: program.registrationCloseDate ?? null,
        location: program.location ?? null,
        capacity: program.capacity ?? null,
        logoUrl: program.logoUrl ?? null,
        thumbnailUrl: program.thumbnailUrl ?? null,
        bannerUrl: program.bannerUrl ?? null,
        videoUrl: program.videoUrl ?? null,
        year: program.year,
        theme: program.theme ?? null,
        programType: program.programType ?? null,
        programFormat: program.programFormat ?? null,
        status: program.status,
        isPublished: program.isPublished,
        isActive: program.isActive,
        isVisibleToUsers: program.isVisibleToUsers,
        allowRegistration: program.allowRegistration,
        requireEmailVerification: program.requireEmailVerification,
        requirePayment: program.requirePayment,
        currency: program.currency ?? null,
        registrationFee: program.registrationFee ?? null,
        enableCurrencyConversion: program.enableCurrencyConversion,
        usdInIdr: program.usdInIdr ?? null,
        requirementsDescription: program.requirementsDescription ?? null,
        benefitsDescription: program.benefitsDescription ?? null,
        termsAndConditions: program.termsAndConditions ?? null,
        metaTitle: program.metaTitle ?? null,
        metaDescription: program.metaDescription ?? null,
        deletedAt: program.deletedAt ?? null,
        brand: program.brand,
    };
  }
}
