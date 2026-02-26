import {
    Controller,
    Get,
    Param,
    UseGuards,
    UnauthorizedException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import {
    GetPortalCertificatesQuery,
    DownloadCertificateCommand,
} from '../application/queries/portal-queries';
import { GetPortalCertificatesHandler } from '../application/queries/handlers/get-portal-certificates.handler';
import { DownloadCertificateHandler } from '../application/commands/handlers/download-certificate.handler';
import { PortalCertificatesResponseDto } from './dto/portal-certificate.dto';
import { DownloadCertificateResponseDto } from './dto/portal-submission-responses.dto';

/**
 * Portal Certificates Controller
 *
 * User-facing certificate endpoints that resolve the participant
 * from the JWT token — no need to know applicationId.
 */
@ApiTags('Portal')
@Controller('portal/certificates')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PortalCertificatesController {
    constructor(
        private readonly getCertificatesHandler: GetPortalCertificatesHandler,
        private readonly downloadCertificateHandler: DownloadCertificateHandler,
    ) { }

    @Get()
    @ApiOperation({
        summary: 'List all certificates and documents for the current user',
        description: 'Returns all certificates and documents across all of the user\'s applications. Resolved from JWT — no need to know applicationId.',
    })
    @ApiResponse({ status: 200, type: PortalCertificatesResponseDto, description: 'Certificates listed successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
    @ApiResponse({ status: 404, description: 'Participant not found' })
    async listCertificates(
        @CurrentUser() user: any,
    ): Promise<PortalCertificatesResponseDto> {
        const userId = user?.userId || user?.id;
        if (!userId) throw new UnauthorizedException();
        return this.getCertificatesHandler.execute(
            new GetPortalCertificatesQuery(userId),
        );
    }

    @Get(':id/download')
    @ApiOperation({
        summary: 'Get download URL for a certificate',
        description: 'Returns the file URL for downloading a certificate. Increments the download count and verifies the certificate belongs to the authenticated user.',
    })
    @ApiParam({
        name: 'id',
        description: 'Certificate document UUID',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiResponse({ status: 200, type: DownloadCertificateResponseDto, description: 'Download URL returned successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
    @ApiResponse({ status: 403, description: 'Certificate does not belong to this user' })
    @ApiResponse({ status: 404, description: 'Certificate not found' })
    async downloadCertificate(
        @CurrentUser() user: any,
        @Param('id') id: string,
    ): Promise<DownloadCertificateResponseDto> {
        const userId = user?.userId || user?.id;
        if (!userId) throw new UnauthorizedException();
        return this.downloadCertificateHandler.execute(
            new DownloadCertificateCommand(userId, id),
        );
    }
}
