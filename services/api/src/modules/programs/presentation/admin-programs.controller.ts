import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { AdminScopeGuard, ScopedBy } from '@shared/guards/admin-scope.guard';
import { AuditTrail } from '@shared/decorators/audit-trail.decorator';
import { CacheInvalidate } from '@shared/decorators/cache-invalidate.decorator';
import { ApplicationCategory, ApplicationStatus, ChangeType } from '@prisma/client';
import { SetFundingDecisionDto, SetFundingDecisionResponseDto } from './dto/funding-decision.dto';

/**
 * Admin-only program lookup.
 * Uses `deletedAt: undefined` to bypass the global soft-delete middleware so
 * admins can view programs that have been soft-deleted (stale session data,
 * archived programs, etc.).
 */
@ApiTags('admin/programs')
@Controller('admin/programs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminProgramsController {
  private readonly logger = new Logger(AdminProgramsController.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records the fully-funded selection result for a batch of applications.
   *
   * Writes a column only: no status change and NO email (admins send results
   * manually; an automatic send would double-notify). Only submitted FF
   * applications are touched - drafts never entered selection and self-funded
   * applicants are not candidates - so a stray id in the batch is skipped, not
   * an error. programId comes from the URL so @ScopedBy checks the same value
   * the WHERE clause filters on; there is no second programId in the body.
   */
  @Post(':programId/applications/funding-decision')
  @UseGuards(AdminScopeGuard)
  @ScopedBy('program', 'programId')
  @HttpCode(HttpStatus.OK)
  @CacheInvalidate(['application:list:*'])
  @AuditTrail({ entityType: 'Program', action: ChangeType.bulk_update, idParam: 'programId' })
  @ApiOperation({ summary: 'Bulk set the fully-funded selection result (no email is sent)' })
  @ApiResponse({ status: 200, type: SetFundingDecisionResponseDto })
  async setFundingDecision(
    @Param('programId', ParseUUIDPipe) programId: string,
    @Body() dto: SetFundingDecisionDto,
  ): Promise<SetFundingDecisionResponseDto> {
    const { count } = await this.prisma.participantApplication.updateMany({
      where: {
        id: { in: dto.applicationIds },
        programId,
        applicationCategory: ApplicationCategory.fully_funded,
        status: { not: ApplicationStatus.draft },
        deletedAt: null,
      },
      data: {
        fundingDecision: dto.decision,
        fundingDecidedAt: dto.decision === null ? null : new Date(),
      },
    });

    this.logger.log(
      `funding decision program=${programId} decision=${dto.decision} requested=${dto.applicationIds.length} updated=${count}`,
    );
    return { updated: count };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get program by ID for admin (bypasses soft-delete filter)' })
  @ApiResponse({ status: 200, description: 'Program found' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'Program not found' })
  async findOneForAdmin(
    @Param('id') id: string,
  ) {
    // Passing `deletedAt: undefined` explicitly causes the soft-delete
    // middleware to be bypassed: the middleware does
    //   `args.where = { deletedAt: null, ...args.where }`
    // so our explicit `deletedAt: undefined` overrides the injected `null`.
    const program = await this.prisma.program.findFirst({
      where: {
        id,
         
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
        previewChecklistItems: program.previewChecklistItems ?? [],
        paymentInfoHtml: program.paymentInfoHtml ?? null,
        metaTitle: program.metaTitle ?? null,
        metaDescription: program.metaDescription ?? null,
        metaKeywords: program.metaKeywords ?? null,
        contactEmail: program.contactEmail ?? null,
        contactPhone: program.contactPhone ?? null,
        contactWhatsapp: program.contactWhatsapp ?? null,
        contactAddress: program.contactAddress ?? null,
        partnersCanvaUrl: program.partnersCanvaUrl ?? null,
        fundingResultsAnnouncedAt: program.fundingResultsAnnouncedAt ?? null,
        landingContent: (program.landingContent as Record<string, unknown>) ?? {},
        deletedAt: program.deletedAt ?? null,
        brand: program.brand,
    };
  }
}
