
import { Controller, Post, Body, Get, Patch, Delete, Param, Query, UseGuards, UnauthorizedException, Put, Ip, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { CreateAdminDto } from './dto/create-admin.dto';
import { CreateAdminCommand } from '../application/commands/create-admin.command';
import { UpdateAdminCommand } from '../application/commands/update-admin.command';
import { DeleteAdminCommand } from '../application/commands/delete-admin.command';
import { GetAdminsQuery } from '../application/queries/get-admins.query';
import { GetAdminQuery } from '../application/queries/get-admin.query';
import { CreateAdminHandler } from '../application/commands/handlers/create-admin.handler';
import { UpdateAdminHandler } from '../application/commands/handlers/update-admin.handler';
import { DeleteAdminHandler } from '../application/commands/handlers/delete-admin.handler';
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
import {
    CreateSupportImpersonationDto,
    UpdateSupportAccessConfigDto,
} from './dto/support-access.dto';

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
        private readonly supportAccessService: SupportAccessService,
    ) { }

    @Post()
    @ApiOperation({ summary: 'Create New Admin' })
    @ApiResponse({ status: 201, description: 'Admin created successfully' })
    @AuditTrail({ entityType: 'Admin', action: ChangeType.create })
    async create(
        @Body() dto: CreateAdminDto,
        @CurrentUser() currentUser: CurrentUserData
    ) {
        // TODO: Verify if currentUser is Super Admin or has 'manage_admins' permission
        // For now, assume protected by role check in Guard or simple check here

        if (!currentUser.adminId) throw new UnauthorizedException('Admin access required');

        const command = new CreateAdminCommand(
            dto.email,
            dto.fullName,
            dto.password,
            currentUser.adminId, // Ensure CurrentUserData has adminId (it does from AdminLoginHandler)
            dto.roleId,
            dto.brandIds
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
    ) {
        const query = new GetAdminsQuery(Number(page), Number(limit), search, roleId, brandId);
        return this.getAdminsHandler.execute(query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get Admin Details' })
    @ApiResponse({ status: 200, description: 'Admin details' })
    async findOne(@Param('id') id: string) {
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
        if (!currentUser.adminId) throw new UnauthorizedException('Admin access required');
        const command = new UpdateAdminCommand(id, dto, currentUser.adminId);
        return this.updateAdminHandler.execute(command);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete/Deactivate Admin' })
    @ApiResponse({ status: 200, description: 'Admin deactivated' })
    @AuditTrail({ entityType: 'Admin', action: ChangeType.delete })
    async remove(
        @Param('id') id: string,
        @CurrentUser() currentUser: CurrentUserData
    ) {
        if (!currentUser.adminId) throw new UnauthorizedException('Admin access required');
        const command = new DeleteAdminCommand(id, currentUser.adminId);
        return this.deleteAdminHandler.execute(command);
    }

    @Get('support-access/config')
    @ApiOperation({ summary: 'Get support access configuration (Super Admin only)' })
    @ApiResponse({ status: 200, description: 'Support access configuration loaded' })
    async getSupportAccessConfig(@CurrentUser() currentUser: CurrentUserData) {
        return this.supportAccessService.getConfig(currentUser);
    }

    @Put('support-access/config')
    @ApiOperation({ summary: 'Update support access configuration (Super Admin only)' })
    @ApiResponse({ status: 200, description: 'Support access configuration updated' })
    async updateSupportAccessConfig(
        @CurrentUser() currentUser: CurrentUserData,
        @Body() dto: UpdateSupportAccessConfigDto,
    ) {
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
        return this.supportAccessService.createImpersonation(
            currentUser,
            dto,
            ipAddress || '0.0.0.0',
            req.headers['user-agent'] || 'unknown',
        );
    }
}
