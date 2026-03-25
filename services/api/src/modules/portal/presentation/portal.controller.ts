import { Controller, Get, Query, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';
import { 
    GetPortalDashboardQuery, 
    GetPortalSubmissionsQuery,
    GetPortalPaymentsQuery,
    GetPortalDocumentsQuery 
} from '../application/queries/portal-queries';
import { PortalDashboardResponseDto } from './dto/portal-dashboard.dto';
import { PortalSubmissionResponseDto } from './dto/portal-submission.dto';
import { PortalPaymentResponseDto } from './dto/portal-payment.dto';
import { PortalDocumentResponseDto } from './dto/portal-document.dto';

@ApiTags('Portal')
@Controller('portal')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PortalController {
    constructor(private readonly queryBus: QueryBus) {}

    @Get('dashboard')
    @ApiOperation({ summary: 'Get participant dashboard summary' })
    @ApiResponse({ status: 200, type: PortalDashboardResponseDto })
    async getDashboard(@CurrentUser() user: CurrentUserData): Promise<PortalDashboardResponseDto> {
        const userId = user.userId;
        if (!userId) throw new UnauthorizedException();
        return this.queryBus.execute(new GetPortalDashboardQuery(userId));
    }

    @Get('submissions')
    @ApiOperation({ summary: 'Get application submission progress' })
    @ApiResponse({ status: 200, type: PortalSubmissionResponseDto })
    async getSubmissions(
        @CurrentUser() user: CurrentUserData,
        @Query('programId') programId?: string,
    ): Promise<PortalSubmissionResponseDto> {
        const userId = user.userId;
        if (!userId) throw new UnauthorizedException();
        return this.queryBus.execute(new GetPortalSubmissionsQuery(userId, programId));
    }

    @Get('payments')
    @ApiOperation({ summary: 'Get pyment history and outstanding items' })
    @ApiResponse({ status: 200, type: PortalPaymentResponseDto })
    async getPayments(@CurrentUser() user: CurrentUserData): Promise<PortalPaymentResponseDto> {
        const userId = user.userId;
        if (!userId) throw new UnauthorizedException();
        return this.queryBus.execute(new GetPortalPaymentsQuery(userId));
    }

    @Get('documents')
    @ApiOperation({ summary: 'Get program resources and my documents' })
    @ApiResponse({ status: 200, type: PortalDocumentResponseDto })
    async getDocuments(@CurrentUser() user: CurrentUserData): Promise<PortalDocumentResponseDto> {
        const userId = user.userId;
        if (!userId) throw new UnauthorizedException();
        return this.queryBus.execute(new GetPortalDocumentsQuery(userId));
    }
}
