import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, UseGuards, HttpCode, HttpStatus, BadRequestException, ForbiddenException, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { QueryBus, CommandBus } from '@nestjs/cqrs';
import { ChangeType } from '@prisma/client';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { AuditTrail } from '@shared/decorators/audit-trail.decorator';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { AdminScope, assertBrandAccess, getRequestAdminScope, orNotFound } from '@shared/guards/admin-scope.guard';
import { ListSignaturesQuery } from '../application/queries/list-signatures.query';
import { CreateSignatureCommand } from '../application/commands/create-signature.command';
import { UpdateSignatureCommand } from '../application/commands/update-signature.command';
import { DeleteSignatureCommand } from '../application/commands/delete-signature.command';
import { CreateSignatureDto, UpdateSignatureDto, SignatureResponseDto } from './dto/signature.dto';

type ScopedRequest = { user?: { adminId?: string }; adminScope?: AdminScope };

@ApiTags('Signatures')
@Controller('admin/signatures')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class SignatureAdminController {
    constructor(
        private readonly queryBus: QueryBus,
        private readonly commandBus: CommandBus,
        private readonly prisma: PrismaService,
        private readonly readPrisma: PrismaReadService,
    ) { }

    @Get()
    @ApiOperation({ summary: 'List active signatures for a brand' })
    @ApiQuery({ name: 'brandId', required: true })
    @ApiResponse({ status: 200, description: 'Return list of signatures', type: [SignatureResponseDto] })
    async list(@Query('brandId') brandId: string, @Req() req: ScopedRequest): Promise<SignatureResponseDto[]> {
        if (!brandId) throw new BadRequestException('brandId query param is required');
        await this.assertSignatureBrandAccess(await getRequestAdminScope(this.readPrisma, req), brandId);
        return this.queryBus.execute(new ListSignaturesQuery(brandId));
    }

    @Post()
    @AuditTrail({ entityType: 'Signature', action: ChangeType.create })
    @ApiOperation({ summary: 'Create a brand signature' })
    @ApiResponse({ status: 201, description: 'Signature created', type: SignatureResponseDto })
    async create(@Body() dto: CreateSignatureDto, @Req() req: ScopedRequest): Promise<SignatureResponseDto> {
        await this.assertSignatureBrandAccess(await getRequestAdminScope(this.readPrisma, req), dto.brandId);
        return this.commandBus.execute(new CreateSignatureCommand(dto));
    }

    @Patch(':id')
    @AuditTrail({ entityType: 'Signature', action: ChangeType.update })
    @ApiOperation({ summary: 'Update a brand signature' })
    @ApiResponse({ status: 200, description: 'Signature updated', type: SignatureResponseDto })
    @ApiResponse({ status: 404, description: 'Signature not found' })
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateSignatureDto,
        @Req() req: ScopedRequest,
    ): Promise<SignatureResponseDto> {
        await this.assertCanAccessSignature(req, id);
        return this.commandBus.execute(new UpdateSignatureCommand(id, dto));
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @AuditTrail({ entityType: 'Signature', action: ChangeType.delete })
    @ApiOperation({ summary: 'Soft-delete a brand signature' })
    @ApiResponse({ status: 204, description: 'Signature deleted' })
    @ApiResponse({ status: 404, description: 'Signature not found' })
    async remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: ScopedRequest): Promise<void> {
        await this.assertCanAccessSignature(req, id);
        return this.commandBus.execute(new DeleteSignatureCommand(id));
    }

    /** Out-of-scope answers exactly like a missing signature (404). */
    private async assertCanAccessSignature(req: ScopedRequest, signatureId: string): Promise<void> {
        const scope = await getRequestAdminScope(this.readPrisma, req);
        if (scope.kind === 'platform') return;

        const notFound = () => new NotFoundException('Signature not found');
        // Primary, the DB the update/delete handlers act on, so a lagging replica cannot fail open.
        const signature = await this.prisma.signature.findFirst({
            where: { id: signatureId, deletedAt: null },
            select: { brandId: true },
        });
        if (!signature) throw notFound();

        await orNotFound(() => this.assertSignatureBrandAccess(scope, signature.brandId), notFound);
    }

    /**
     * Brand grant for brand-scoped admins. An 'assigned' admin has no brand grant, but the
     * LOA editor that manages these is per program, so they may use the signatures of a
     * brand that owns one of their programs (assertBrandAccess alone would lock them out).
     */
    private async assertSignatureBrandAccess(scope: AdminScope, brandId: string): Promise<void> {
        if (scope.kind !== 'assigned') {
            assertBrandAccess(scope, brandId);
            return;
        }

        const ownedPrograms = await this.readPrisma.program.count({
            where: { id: { in: scope.allowedProgramIds ?? [] }, brandId, deletedAt: null },
        });
        if (ownedPrograms === 0) {
            throw new ForbiddenException('You do not have access to this brand.');
        }
    }
}
