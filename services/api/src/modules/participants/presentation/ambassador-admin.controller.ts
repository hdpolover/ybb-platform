import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Query,
  Body,
  Patch,
  Delete,
  Req,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import {
  GetAmbassadorsListQuery,
  UpdateAmbassadorStatusCommand,
  GetAmbassadorReferralsQuery,
} from '../application/commands/ambassador-admin.commands';
import { DeleteAmbassadorCommand } from '../application/commands/delete-ambassador.command';
import { AuditTrail } from '@shared/decorators/audit-trail.decorator';
import { ChangeType } from '@prisma/client';
import { createAmbassadorShareToken } from '../application/utils/ambassador-share-token.util';

@ApiTags('Ambassadors')
@Controller('admin/ambassadors')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AmbassadorAdminController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    private readonly prisma: PrismaService,
  ) { }

  @Get()
  @ApiOperation({ summary: 'List all ambassadors (Admin)' })
  @ApiQuery({ name: 'programId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortOrder', required: false })
  async findAll(
    @Query('programId') programId?: string,
    @Query('search') search?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.queryBus.execute(new GetAmbassadorsListQuery(programId, search, Number(page), Number(limit), sortBy, sortOrder));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ambassador detail (Admin)' })
  async findOne(@Param('id') id: string) {
    const ambassador = await this.prisma.ambassador.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: { select: { email: true } },
        program: {
          select: {
            id: true,
            name: true,
            slug: true,
            brand: { select: { websiteUrl: true } },
          },
        },
      },
    });

    if (!ambassador) {
      throw new NotFoundException('Ambassador not found');
    }

    const referrals = await this.prisma.ambassadorReferral.findMany({
      where: { ambassadorId: id },
      select: {
        status: true,
        totalConversionDays: true,
      },
    });

    const statusCounts = {
      referred: 0,
      registered: 0,
      applied: 0,
      accepted: 0,
      completed: 0,
    };
    let conversionTotal = 0;
    let conversionCount = 0;

    referrals.forEach((referral) => {
      if (referral.status in statusCounts) {
        statusCounts[referral.status as keyof typeof statusCounts] += 1;
      }
      if (typeof referral.totalConversionDays === 'number') {
        conversionTotal += referral.totalConversionDays;
        conversionCount += 1;
      }
    });

    const brandUrl = ambassador.program.brand.websiteUrl || 'ybb.co';
    const cleanBrandUrl = brandUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const shareToken = createAmbassadorShareToken(ambassador.id);
    const shareLink = `https://${cleanBrandUrl}/programs/${ambassador.program.slug}?r=${shareToken}`;

    return {
      ...ambassador,
      shareLink,
      programName: ambassador.program.name,
      analytics: {
        statusCounts,
        averageConversionDays: conversionCount > 0 ? Math.round(conversionTotal / conversionCount) : null,
      },
    };
  }

  @Post()
  @AuditTrail({ entityType: 'Ambassador', action: ChangeType.create })
  @ApiOperation({ summary: 'Create a new ambassador (Admin)' })
  async create(
    @Body() body: {
      email: string;
      fullName: string;
      programId: string;
      phoneNumber?: string;
      institution?: string;
      gender?: string;
      notes?: string;
    },
  ) {
    const { email, fullName, programId, phoneNumber, institution, gender, notes } = body;

    if (!email || !fullName || !programId) {
      throw new BadRequestException('email, fullName, and programId are required');
    }

    // Resolve program to get brandId
    const program = await this.prisma.program.findUnique({ where: { id: programId }, select: { id: true, brandId: true } });
    if (!program) throw new NotFoundException('Program not found');

    // Find or create user
    let user = await this.prisma.user.findFirst({ where: { email, brandId: program.brandId } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          brandId: program.brandId,
          emailVerified: true,
        },
      });
    }

    // Check already ambassador
    const existing = await this.prisma.ambassador.findUnique({ where: { userId: user.id } });
    if (existing && !existing.deletedAt) {
      throw new ConflictException('This user is already an ambassador');
    }

    // Generate referral code: up to 3 letters from name + 5 random digits
    const namePrefix = fullName.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3).padEnd(3, 'X');
    const digits = Math.floor(10000 + Math.random() * 90000).toString();
    let referralCode = namePrefix + digits;
    // Ensure uniqueness — retry once on collision
    const collision = await this.prisma.ambassador.findFirst({ where: { referralCode } });
    if (collision) {
      referralCode = namePrefix + Math.floor(10000 + Math.random() * 90000).toString();
    }

    const ambassador = await this.prisma.ambassador.create({
      data: {
        userId: user.id,
        programId,
        fullName,
        phoneNumber: phoneNumber ?? null,
        institution: institution ?? null,
        gender: (gender as any) ?? null,
        notes: notes ?? null,
        referralCode,
        isActive: true,
        activatedAt: new Date(),
      },
      include: { user: { select: { email: true } } },
    });

    return ambassador;
  }

  @Patch(':id')
  @AuditTrail({ entityType: 'Ambassador', action: ChangeType.update })
  @ApiOperation({ summary: 'Update ambassador details (Admin)' })
  async update(
    @Param('id') id: string,
    @Body() body: {
      fullName?: string;
      phoneNumber?: string;
      institution?: string;
      gender?: string;
      notes?: string;
    },
  ) {
    const ambassador = await this.prisma.ambassador.findUnique({ where: { id } });
    if (!ambassador || ambassador.deletedAt) throw new NotFoundException('Ambassador not found');

    return this.prisma.ambassador.update({
      where: { id },
      data: {
        fullName: body.fullName ?? undefined,
        phoneNumber: body.phoneNumber ?? undefined,
        institution: body.institution ?? undefined,
        gender: (body.gender as any) ?? undefined,
        notes: body.notes ?? undefined,
      },
      include: { user: { select: { email: true } } },
    });
  }

  @Patch(':id/activate')
  @AuditTrail({ entityType: 'Ambassador', action: ChangeType.update })
  @ApiOperation({ summary: 'Activate an ambassador' })
  async activate(@Param('id') id: string) {
    return this.commandBus.execute(new UpdateAmbassadorStatusCommand(id, true));
  }

  @Patch(':id/deactivate')
  @AuditTrail({ entityType: 'Ambassador', action: ChangeType.update })
  @ApiOperation({ summary: 'Deactivate an ambassador' })
  async deactivate(@Param('id') id: string) {
    return this.commandBus.execute(new UpdateAmbassadorStatusCommand(id, false));
  }

  @Get(':id/referrals')
  @ApiOperation({ summary: 'List referrals for a specific ambassador (Admin)' })
  @ApiQuery({ name: 'page', required: false })
  async getReferrals(
    @Param('id') id: string,
    @Query('page') page: number = 1,
  ) {
    return this.queryBus.execute(new GetAmbassadorReferralsQuery(id, page));
  }

  @Delete(':id')
  @AuditTrail({ entityType: 'Ambassador', action: ChangeType.delete })
  @ApiOperation({ summary: 'Soft-delete an ambassador (Admin)' })
  async remove(@Param('id') id: string, @Req() req: any) {
    const deletedBy: string = req.user?.id ?? req.user?.sub;
    return this.commandBus.execute(new DeleteAmbassadorCommand(id, deletedBy));
  }
}
