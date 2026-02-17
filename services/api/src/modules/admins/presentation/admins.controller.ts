
import { Controller, Post, Body, Get, Patch, Delete, Param, Query, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
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
import { CurrentUser, CurrentUserData } from '../../../shared/decorators/current-user.decorator';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { AuditTrail } from '../../../shared/decorators/audit-trail.decorator';
import { ChangeType } from '@prisma/client';

@ApiTags('admins')
@Controller('admins')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdminsController {
    constructor(
        private readonly createAdminHandler: CreateAdminHandler,
        private readonly getAdminsHandler: GetAdminsHandler,
        private readonly getAdminHandler: GetAdminHandler,
        private readonly updateAdminHandler: UpdateAdminHandler,
        private readonly deleteAdminHandler: DeleteAdminHandler,
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
}
