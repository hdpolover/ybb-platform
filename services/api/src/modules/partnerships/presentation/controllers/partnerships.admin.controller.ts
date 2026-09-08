import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { AuditTrail } from '@shared/decorators/audit-trail.decorator';
import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';
import { ChangeType } from '@prisma/client';

type UpdatePartnershipEnquiryStatusDto = {
  status: string;
};

type UpdatePartnershipEnquiryDto = {
  status?: string;
  notes?: string | null;
};

@ApiTags('Partnerships')
@Controller('admin/programs/:programId/partnership-enquiries')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class PartnershipsAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Admin: list partnership enquiries for a program' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated list of partnership enquiries' })
  async list(
    @Param('programId') programId: string,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
  ) {
    const page = Math.max(1, Number(pageRaw || 1));
    const limit = Math.min(100, Math.max(1, Number(limitRaw || 20)));
    const trimmedStatus = status?.trim();
    const trimmedType = type?.trim();
    const trimmedSearch = search?.trim();

    const where = {
      programId,
      // Soft-deleted rows must never resurface in the admin list — this was
      // missing before soft-delete existed, so it was latent rather than
      // exercised. Now that DELETE below sets deletedAt, it is load-bearing.
      deletedAt: null,
      ...(trimmedStatus ? { status: trimmedStatus } : {}),
      ...(trimmedType ? { partnershipType: trimmedType } : {}),
      ...(trimmedSearch
        ? {
            OR: [
              { fullName: { contains: trimmedSearch, mode: 'insensitive' as const } },
              { email: { contains: trimmedSearch, mode: 'insensitive' as const } },
              { company: { contains: trimmedSearch, mode: 'insensitive' as const } },
              { subject: { contains: trimmedSearch, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.partnershipEnquiry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.partnershipEnquiry.count({ where }),
    ]);

    return {
      data: items.map((item) => ({
        id: item.id,
        programId: item.programId,
        brandId: item.brandId,
        partnershipType: item.partnershipType,
        subCategory: item.subCategory,
        fullName: item.fullName,
        email: item.email,
        whatsappNumber: item.whatsappNumber,
        company: item.company,
        subject: item.subject,
        description: item.description,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Admin: get full detail for one partnership enquiry' })
  @ApiResponse({ status: 200, description: 'Partnership enquiry detail' })
  @ApiResponse({ status: 404, description: 'Not found for this program, or soft-deleted' })
  async getOne(@Param('programId') programId: string, @Param('id') id: string) {
    // deletedAt: null here too, for the same reason as list() — a
    // soft-deleted row must read as gone, not as a live enquiry.
    const enquiry = await this.prisma.partnershipEnquiry.findFirst({
      where: { id, programId, deletedAt: null },
    });

    if (!enquiry) {
      throw new NotFoundException('Partnership enquiry not found for this program');
    }

    return enquiry;
  }

  /**
   * The single admin write path: status and/or internal notes.
   *
   * Replaces the previous :id/status route, which the rebuilt page no longer
   * calls. Two routes writing the same columns is how they drift, and these two
   * had already drifted — the old one answered 400 for a missing enquiry where
   * everything else here answers 404.
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Admin: update partnership enquiry status and/or internal notes' })
  @ApiResponse({ status: 200, description: 'Updated partnership enquiry' })
  @ApiResponse({ status: 404, description: 'Not found for this program, or soft-deleted' })
  @AuditTrail({ entityType: 'PartnershipEnquiry', action: ChangeType.update })
  async update(
    @Param('programId') programId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePartnershipEnquiryDto,
    @CurrentUser() actor: CurrentUserData,
  ) {
    const nextStatus = dto.status?.trim();
    if (dto.status !== undefined && !nextStatus) {
      throw new BadRequestException('status must not be empty');
    }
    if (nextStatus && nextStatus.length > 20) {
      throw new BadRequestException('status must be 20 characters or fewer');
    }

    const existing = await this.prisma.partnershipEnquiry.findFirst({
      where: { id, programId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Partnership enquiry not found for this program');
    }

    // handledBy/handledAt stamp on ANY admin write here (status change or a
    // notes-only edit) — an admin editing notes has "handled" the enquiry
    // just as much as one flipping its status.
    await this.prisma.partnershipEnquiry.update({
      where: { id },
      data: {
        ...(nextStatus !== undefined ? { status: nextStatus } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        handledBy: actor?.adminId ?? null,
        handledAt: new Date(),
      },
    });

    return this.prisma.partnershipEnquiry.findUniqueOrThrow({ where: { id } });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Admin: soft-delete a partnership enquiry' })
  @ApiResponse({ status: 200, description: 'Enquiry soft-deleted' })
  @ApiResponse({ status: 404, description: 'Not found for this program, or already deleted' })
  @AuditTrail({ entityType: 'PartnershipEnquiry', action: ChangeType.delete })
  async remove(@Param('programId') programId: string, @Param('id') id: string) {
    // updateMany + deletedAt:null guard, not delete(): re-deleting an
    // already-deleted row must 404 rather than silently succeed or throw a
    // Prisma P2025 500.
    const deleted = await this.prisma.partnershipEnquiry.updateMany({
      where: { id, programId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    if (deleted.count === 0) {
      throw new NotFoundException('Partnership enquiry not found for this program');
    }

    return { success: true };
  }
}
