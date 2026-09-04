
import { Controller, Post, Body, Get, Patch, Delete, Param, Query, UseGuards, UnauthorizedException, Put, Ip, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { CreateAdminDto } from './dto/create-admin.dto';
import { CreateAdminCommand } from '../application/commands/create-admin.command';
import { UpdateAdminCommand } from '../application/commands/update-admin.command';
import { DeleteAdminCommand } from '../application/commands/delete-admin.command';
import { RestoreAdminCommand } from '../application/commands/restore-admin.command';
import { GetAdminsQuery } from '../application/queries/get-admins.query';
import { GetAdminQuery } from '../application/queries/get-admin.query';
import { CreateAdminHandler } from '../application/commands/handlers/create-admin.handler';
import { UpdateAdminHandler } from '../application/commands/handlers/update-admin.handler';
import { DeleteAdminHandler } from '../application/commands/handlers/delete-admin.handler';
import { RestoreAdminHandler } from '../application/commands/handlers/restore-admin.handler';
import { GetAdminsHandler } from '../application/queries/handlers/get-admins.handler';
import { GetAdminHandler } from '../application/queries/handlers/get-admin.handler';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/infrastructure/guards/roles.guard';
import { Roles } from '../../auth/application/decorators/roles.decorator';
import { UserRole } from '../../../core/entities/user.entity';
import { CurrentUser, CurrentUserData } from '../../../shared/decorators/current-user.decorator';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { AuditTrail } from '../../../shared/decorators/audit-trail.decorator';
import { ChangeType } from '@prisma/client';
import { SupportAccessService } from '../application/services/support-access.service';
import { AdminAccessControlService } from '../application/services/admin-access-control.service';
import {
    CreateSupportImpersonationDto,
    UpdateSupportAccessConfigDto,
} from './dto/support-access.dto';
import { ResetAdminPasswordDto } from './dto/reset-admin-password.dto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';

@ApiTags('admins')
@Controller('admins')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminsController {
    constructor(
        private readonly createAdminHandler: CreateAdminHandler,
        private readonly getAdminsHandler: GetAdminsHandler,
        private readonly getAdminHandler: GetAdminHandler,
        private readonly updateAdminHandler: UpdateAdminHandler,
        private readonly deleteAdminHandler: DeleteAdminHandler,
        private readonly restoreAdminHandler: RestoreAdminHandler,
        private readonly supportAccessService: SupportAccessService,
        private readonly adminAccessControl: AdminAccessControlService,
        private readonly prisma: PrismaService,
    ) { }

    @Post()
    @ApiOperation({ summary: 'Create New Admin' })
    @ApiResponse({ status: 201, description: 'Admin created successfully' })
    @AuditTrail({ entityType: 'Admin', action: ChangeType.create })
    async create(
        @Body() dto: CreateAdminDto,
        @CurrentUser() currentUser: CurrentUserData
    ) {
        await this.adminAccessControl.assertCanManageAdmins(currentUser);
        const adminId = currentUser.adminId;
        if (!adminId) throw new UnauthorizedException('Admin access required');

        const command = new CreateAdminCommand(
            dto.email,
            dto.fullName,
            dto.password,
            adminId,
            dto.roleId,
            dto.brandIds,
            dto.programIds,
        );
        return this.createAdminHandler.execute(command);
    }

    @Get()
    @ApiOperation({ summary: 'List Admins' })
    @ApiResponse({ status: 200, description: 'List of admins' })
    async findAll(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
        @Query('search') search?: string,
        @Query('roleId') roleId?: string,
        @Query('brandId') brandId?: string,
        @Query('programId') programId?: string,
        @CurrentUser() currentUser?: CurrentUserData,
    ) {
        if (currentUser) {
            await this.adminAccessControl.assertCanManageAdmins(currentUser);
        }
        const query = new GetAdminsQuery(Number(page), Number(limit), search, roleId, brandId, programId);
        return this.getAdminsHandler.execute(query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get Admin Details' })
    @ApiResponse({ status: 200, description: 'Admin details' })
    async findOne(
        @Param('id') id: string,
        @CurrentUser() currentUser: CurrentUserData,
    ) {
        await this.adminAccessControl.assertCanManageAdmins(currentUser);
        const query = new GetAdminQuery(id);
        return this.getAdminHandler.execute(query);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update Admin' })
    @ApiResponse({ status: 200, description: 'Admin updated' })
    @AuditTrail({ entityType: 'Admin', action: ChangeType.update })
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateAdminDto,
        @CurrentUser() currentUser: CurrentUserData
    ) {
        await this.adminAccessControl.assertCanManageAdmins(currentUser);
        const adminId = currentUser.adminId;
        if (!adminId) throw new UnauthorizedException('Admin access required');
        const command = new UpdateAdminCommand(id, dto, adminId);
        return this.updateAdminHandler.execute(command);
    }

    @Post(':id/reset-password')
    @ApiOperation({ summary: 'Reset Admin Password' })
    @ApiResponse({ status: 200, description: 'Admin password reset successfully' })
    async resetPassword(
        @Param('id') id: string,
        @Body() dto: ResetAdminPasswordDto,
        @CurrentUser() currentUser: CurrentUserData,
    ) {
        await this.adminAccessControl.assertCanManageAdmins(currentUser);

        const admin = await this.prisma.admin.findUnique({
            where: { id },
            include: {
                user: {
                    select: { id: true },
                },
            },
        });

        if (!admin?.user?.id) {
            throw new UnauthorizedException('Admin access required');
        }

        await this.prisma.user.update({
            where: { id: admin.user.id },
            data: {
                passwordHash: await bcrypt.hash(dto.password, 10),
                failedLoginAttempts: 0,
                // Clear the lock too, matching the self-service path in
                // reset-password.handler.ts. An authorised operator resetting
                // an admin's password intends to restore access; clearing the
                // streak but leaving lockedUntil set means they hand back a
                // working password that still cannot log in, with nothing to
                // say why. The two credential-reset paths must not disagree.
                lockedUntil: null,
            },
        });

        return { message: 'Admin password reset successfully' };
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete/Deactivate Admin' })
    @ApiResponse({ status: 200, description: 'Admin deactivated' })
    @AuditTrail({ entityType: 'Admin', action: ChangeType.delete })
    async remove(
        @Param('id') id: string,
        @CurrentUser() currentUser: CurrentUserData
    ) {
        await this.adminAccessControl.assertCanManageAdmins(currentUser);
        const adminId = currentUser.adminId;
        if (!adminId) throw new UnauthorizedException('Admin access required');
        const command = new DeleteAdminCommand(id, adminId);
        return this.deleteAdminHandler.execute(command);
    }

    @Post(':id/restore')
    @ApiOperation({ summary: 'Restore a previously deleted Admin' })
    @ApiResponse({ status: 200, description: 'Admin restored' })
    @ApiResponse({ status: 404, description: 'No deleted admin with that id' })
    @AuditTrail({ entityType: 'Admin', action: ChangeType.update })
    async restore(
        @Param('id') id: string,
        @CurrentUser() currentUser: CurrentUserData
    ) {
        await this.adminAccessControl.assertCanManageAdmins(currentUser);
        const adminId = currentUser.adminId;
        if (!adminId) throw new UnauthorizedException('Admin access required');
        const command = new RestoreAdminCommand(id, adminId);
        return this.restoreAdminHandler.execute(command);
    }

    @Get('support-access/config')
    @ApiOperation({ summary: 'Get support access configuration (Super Admin only)' })
    @ApiResponse({ status: 200, description: 'Support access configuration loaded' })
    async getSupportAccessConfig(@CurrentUser() currentUser: CurrentUserData) {
        if (!currentUser.adminId) throw new UnauthorizedException('Admin access required');
        return this.supportAccessService.getConfig(currentUser);
    }

    @Put('support-access/config')
    @ApiOperation({ summary: 'Update support access configuration (Super Admin only)' })
    @ApiResponse({ status: 200, description: 'Support access configuration updated' })
    async updateSupportAccessConfig(
        @CurrentUser() currentUser: CurrentUserData,
        @Body() dto: UpdateSupportAccessConfigDto,
    ) {
        if (!currentUser.adminId) throw new UnauthorizedException('Admin access required');
        return this.supportAccessService.updateConfig(currentUser, dto);
    }

    @Post('support-access/impersonations')
    @ApiOperation({ summary: 'Create one-time participant impersonation login URL (Super Admin only)' })
    @ApiResponse({ status: 201, description: 'Impersonation URL created' })
    async createSupportImpersonation(
        @CurrentUser() currentUser: CurrentUserData,
        @Body() dto: CreateSupportImpersonationDto,
        @Ip() ipAddress: string,
        @Req() req: Request,
    ) {
        if (!currentUser.adminId) throw new UnauthorizedException('Admin access required');
        return this.supportAccessService.createImpersonation(
            currentUser,
            dto,
            ipAddress || '0.0.0.0',
            req.headers['user-agent'] || 'unknown',
        );
    }
}
