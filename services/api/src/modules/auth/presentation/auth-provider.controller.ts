import { Controller, Post, Body, Put, Param, Delete, UseGuards, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CreateAuthProviderDto } from './dto/create-auth-provider.dto';
import { UpdateAuthProviderDto } from './dto/update-auth-provider.dto';
import { AuthProviderDto } from './dto/auth-provider.dto'; // Reuse existing DTO or create new one
import { CreateAuthProviderHandler } from '../application/commands/handlers/create-auth-provider.handler';
import { UpdateAuthProviderHandler } from '../application/commands/handlers/update-auth-provider.handler';
import { DeleteAuthProviderHandler } from '../application/commands/handlers/delete-auth-provider.handler';
import { CreateAuthProviderCommand } from '../application/commands/create-auth-provider.command';
import { UpdateAuthProviderCommand } from '../application/commands/update-auth-provider.command';
import { DeleteAuthProviderCommand } from '../application/commands/delete-auth-provider.command';
import { JwtAuthGuard } from '../infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../infrastructure/guards/roles.guard';
import { Roles } from '../application/decorators/roles.decorator';
import { UserRole } from '../../../core/entities/user.entity';

@ApiTags('Auth')
@Controller('auth/providers')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AuthProviderController {
  constructor(
    private readonly createHandler: CreateAuthProviderHandler,
    private readonly updateHandler: UpdateAuthProviderHandler,
    private readonly deleteHandler: DeleteAuthProviderHandler,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create Authentication Provider (Admin)' })
  @ApiResponse({ status: 201, description: 'Provider created successfully' })
  async create(@Body() dto: CreateAuthProviderDto) {
    const command = new CreateAuthProviderCommand(
      dto.name,
      dto.displayName,
      dto.description,
      dto.clientId,
      dto.clientSecret,
      dto.authUrl,
      dto.tokenUrl,
      dto.scopes,
      dto.isActive,
      dto.isOAuth,
      dto.icon,
      dto.buttonColor,
      dto.order,
    );
    return this.createHandler.execute(command);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update Authentication Provider (Admin)' })
  @ApiResponse({ status: 200, description: 'Provider updated successfully' })
  async update(@Param('id') id: string, @Body() dto: UpdateAuthProviderDto) {
    const command = new UpdateAuthProviderCommand(id, dto);
    return this.updateHandler.execute(command);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Authentication Provider (Admin)' })
  @ApiResponse({ status: 200, description: 'Provider deleted successfully' })
  async delete(@Param('id') id: string) {
    const command = new DeleteAuthProviderCommand(id);
    return this.deleteHandler.execute(command);
  }
}
