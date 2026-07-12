import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, HttpCode, HttpStatus, BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { QueryBus, CommandBus } from '@nestjs/cqrs';
import { ChangeType } from '@prisma/client';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { AuditTrail } from '@shared/decorators/audit-trail.decorator';
import { ListSignaturesQuery } from '../application/queries/list-signatures.query';
import { CreateSignatureCommand } from '../application/commands/create-signature.command';
import { UpdateSignatureCommand } from '../application/commands/update-signature.command';
import { DeleteSignatureCommand } from '../application/commands/delete-signature.command';
import { CreateSignatureDto, UpdateSignatureDto, SignatureResponseDto } from './dto/signature.dto';

@ApiTags('Signatures')
@Controller('admin/signatures')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class SignatureAdminController {
    constructor(
        private readonly queryBus: QueryBus,
        private readonly commandBus: CommandBus,
    ) { }

    @Get()
    @ApiOperation({ summary: 'List active signatures for a brand' })
    @ApiQuery({ name: 'brandId', required: true })
    @ApiResponse({ status: 200, description: 'Return list of signatures', type: [SignatureResponseDto] })
    async list(@Query('brandId') brandId: string): Promise<SignatureResponseDto[]> {
        if (!brandId) throw new BadRequestException('brandId query param is required');
        return this.queryBus.execute(new ListSignaturesQuery(brandId));
    }

    @Post()
    @AuditTrail({ entityType: 'Signature', action: ChangeType.create })
    @ApiOperation({ summary: 'Create a brand signature' })
    @ApiResponse({ status: 201, description: 'Signature created', type: SignatureResponseDto })
    async create(@Body() dto: CreateSignatureDto): Promise<SignatureResponseDto> {
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
    ): Promise<SignatureResponseDto> {
        return this.commandBus.execute(new UpdateSignatureCommand(id, dto));
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @AuditTrail({ entityType: 'Signature', action: ChangeType.delete })
    @ApiOperation({ summary: 'Soft-delete a brand signature' })
    @ApiResponse({ status: 204, description: 'Signature deleted' })
    @ApiResponse({ status: 404, description: 'Signature not found' })
    async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
        return this.commandBus.execute(new DeleteSignatureCommand(id));
    }
}
