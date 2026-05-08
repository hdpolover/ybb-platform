import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { UserRole } from '@core/entities/user.entity';
import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { normalizePermissions } from '@shared/admin-access-response';
import { CreateAdminRoleDto } from './dto/create-admin-role.dto';
import { UpdateAdminRoleDto } from './dto/update-admin-role.dto';
import { AdminAccessControlService } from '../application/services/admin-access-control.service';

@ApiTags('admin-roles')
@Controller('admin-roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminRolesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminAccessControl: AdminAccessControlService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List admin roles' })
  @ApiResponse({ status: 200, description: 'Admin roles loaded successfully' })
  async listRoles(
    @CurrentUser() currentUser: CurrentUserData,
    @Query('programId') programId?: string,
    @Query('search') search?: string,
  ) {
    try {
      await this.adminAccessControl.assertCanAssignRoles(currentUser);
    } catch {
      await this.adminAccessControl.assertCanManageAdmins(currentUser);
    }

    const where: Prisma.AdminRoleWhereInput = {
      deletedAt: null,
    };

    if (search?.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const roles = await this.prisma.adminRole.findMany({
      where,
      orderBy: [{ name: 'asc' }],
      include: {
        _count: {
          select: {
            admins: {
              where: {
                deletedAt: null,
                ...(programId
                  ? {
                      adminPrograms: {
                        some: {
                          programId,
                          removedAt: null,
                        },
                      },
                    }
                  : {}),
              },
            },
          },
        },
      },
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: normalizePermissions(role.permissions),
      isActive: role.isActive,
      usersCount: role._count.admins,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }));
  }

  @Post()
  @ApiOperation({ summary: 'Create admin role' })
  @ApiResponse({ status: 201, description: 'Admin role created successfully' })
  async createRole(
    @CurrentUser() currentUser: CurrentUserData,
    @Body() dto: CreateAdminRoleDto,
  ) {
    await this.adminAccessControl.assertCanAssignRoles(currentUser);

    const normalizedName = dto.name.trim();
    const permissions = Array.from(
      new Set(
        dto.permissions
          .map((permission) => permission.trim())
          .filter((permission) => permission.length > 0),
      ),
    );

    if (!normalizedName) {
      throw new BadRequestException('Role name is required.');
    }

    const existingRole = await this.prisma.adminRole.findFirst({
      where: {
        deletedAt: null,
        name: { equals: normalizedName, mode: 'insensitive' },
      },
    });

    if (existingRole) {
      throw new ConflictException('An admin role with that name already exists.');
    }

    return this.prisma.adminRole.create({
      data: {
        name: normalizedName,
        description: dto.description?.trim() || null,
        permissions,
        isActive: true,
      },
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update admin role' })
  @ApiResponse({ status: 200, description: 'Admin role updated successfully' })
  async updateRole(
    @CurrentUser() currentUser: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateAdminRoleDto,
  ) {
    await this.adminAccessControl.assertCanAssignRoles(currentUser);

    const existingRole = await this.prisma.adminRole.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existingRole) {
      throw new NotFoundException('Admin role not found.');
    }

    const normalizedName = dto.name?.trim();
    if (normalizedName && normalizedName.toLowerCase() !== existingRole.name.toLowerCase()) {
      const duplicateRole = await this.prisma.adminRole.findFirst({
        where: {
          deletedAt: null,
          id: { not: id },
          name: { equals: normalizedName, mode: 'insensitive' },
        },
      });

      if (duplicateRole) {
        throw new ConflictException('An admin role with that name already exists.');
      }
    }

    const permissions = dto.permissions
      ? Array.from(
          new Set(
            dto.permissions
              .map((permission) => permission.trim())
              .filter((permission) => permission.length > 0),
          ),
        )
      : undefined;

    const role = await this.prisma.adminRole.update({
      where: { id },
      data: {
        ...(normalizedName ? { name: normalizedName } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(permissions !== undefined ? { permissions } : {}),
      },
    });

    if (permissions !== undefined || normalizedName) {
      const nextRoleName = normalizedName ?? role.name;
      const nextPermissions = permissions ?? normalizePermissions(role.permissions);

      await this.prisma.$transaction([
        this.prisma.adminProgram.updateMany({
          where: {
            admin: {
              roleId: id,
              deletedAt: null,
            },
            removedAt: null,
          },
          data: {
            roleInProgram: nextRoleName,
            permissions: nextPermissions,
          },
        }),
        this.prisma.adminBrand.updateMany({
          where: {
            admin: {
              roleId: id,
              deletedAt: null,
            },
          },
          data: {
            roleInBrand: nextRoleName,
            permissions: nextPermissions,
          },
        }),
      ]);
    }

    return role;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete admin role' })
  @ApiResponse({ status: 200, description: 'Admin role deleted successfully' })
  async deleteRole(
    @CurrentUser() currentUser: CurrentUserData,
    @Param('id') id: string,
  ) {
    await this.adminAccessControl.assertCanAssignRoles(currentUser);

    const role = await this.prisma.adminRole.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: {
            admins: {
              where: {
                deletedAt: null,
              },
            },
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Admin role not found.');
    }

    if (role._count.admins > 0) {
      throw new ConflictException('This role is still assigned to active administrators.');
    }

    await this.prisma.adminRole.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    return { message: 'Admin role deleted successfully' };
  }
}
