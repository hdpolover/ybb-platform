// src/modules/brand-email/brand-email.controller.ts
import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChangeType } from '@prisma/client';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { AuditTrail } from '@shared/decorators/audit-trail.decorator';
import { AdminScopeGuard, ScopedBy } from '@shared/guards/admin-scope.guard';
import { BrandEmailService, BrandEmailThemeResponse, DraftCampaignResponse } from './brand-email.service';
import { BrandEmailThemeDto } from './dto/brand-email-theme.dto';

// Same guard stack and roles as the existing brand/program admin routes.
@ApiTags('Brand Email')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, AdminScopeGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class BrandEmailController {
    constructor(private readonly service: BrandEmailService) {}

    @Get('brands/:id/email-theme')
    @ScopedBy('brand', 'id')
    @ApiOperation({ summary: 'Get stored + effective brand email theme and Listmonk sync status' })
    getTheme(@Param('id', ParseUUIDPipe) id: string): Promise<BrandEmailThemeResponse> {
        return this.service.getTheme(id);
    }

    @Put('brands/:id/email-theme')
    @ScopedBy('brand', 'id')
    @AuditTrail({ entityType: 'Brand', action: ChangeType.update })
    @ApiOperation({ summary: 'Replace the brand email theme and regenerate its Listmonk template' })
    saveTheme(@Param('id', ParseUUIDPipe) id: string, @Body() dto: BrandEmailThemeDto): Promise<BrandEmailThemeResponse> {
        return this.service.saveTheme(id, dto);
    }

    @Get('brands/:id/email-theme/preview')
    @ScopedBy('brand', 'id')
    @ApiOperation({ summary: 'Rendered template HTML with sample content (for an iframe srcdoc)' })
    async preview(@Param('id', ParseUUIDPipe) id: string): Promise<{ html: string }> {
        return { html: await this.service.preview(id) };
    }

    @Post('brands/:id/email-theme/resync')
    @HttpCode(HttpStatus.OK)
    @ScopedBy('brand', 'id')
    @AuditTrail({ entityType: 'Brand', action: ChangeType.update })
    @ApiOperation({ summary: 'Re-render and push the brand template to Listmonk' })
    resync(@Param('id', ParseUUIDPipe) id: string): Promise<BrandEmailThemeResponse> {
        return this.service.resync(id);
    }

    @Post('programs/:id/email-campaigns')
    @ScopedBy('program', 'id')
    @AuditTrail({ entityType: 'Program', action: ChangeType.create })
    @ApiOperation({ summary: 'Create a draft Listmonk campaign for the program (brand template, program list, brand From)' })
    createDraftCampaign(@Param('id', ParseUUIDPipe) id: string): Promise<DraftCampaignResponse> {
        return this.service.createDraftCampaign(id);
    }
}
