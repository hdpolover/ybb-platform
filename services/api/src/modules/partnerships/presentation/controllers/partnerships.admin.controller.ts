import {
  BadRequestException,
  Body,
  Controller,
  Get,
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
import { ChangeType } from '@prisma/client';

type UpdatePartnershipEnquiryStatusDto = {
  status: string;
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
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated list of partnership enquiries' })
  async list(
    @Param('programId') programId: string,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const page = Math.max(1, Number(pageRaw || 1));
    const limit = Math.min(100, Math.max(1, Number(limitRaw || 20)));
    const trimmedStatus = status?.trim();
    const trimmedSearch = search?.trim();

    const where = {
      programId,
      ...(trimmedStatus ? { status: trimmedStatus } : {}),
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

  @Patch(':id/status')
  @ApiOperation({ summary: 'Admin: update partnership enquiry status' })
  @ApiResponse({ status: 200, description: 'Updated partnership enquiry' })
  @AuditTrail({ entityType: 'PartnershipEnquiry', action: ChangeType.update })
  async updateStatus(
    @Param('programId') programId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePartnershipEnquiryStatusDto,
  ) {
    const nextStatus = dto.status?.trim();
    if (!nextStatus) {
      throw new BadRequestException('status is required');
    }

    if (nextStatus.length > 20) {
      throw new BadRequestException('status must be 20 characters or fewer');
    }

    const updated = await this.prisma.partnershipEnquiry.updateMany({
      where: { id, programId },
      data: { status: nextStatus },
    });

    if (updated.count === 0) {
      throw new BadRequestException('Partnership enquiry not found for this program');
    }

    return this.prisma.partnershipEnquiry.findUniqueOrThrow({ where: { id } });
  }
}
